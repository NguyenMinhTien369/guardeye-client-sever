import { ConfigReader, ConfigError } from "./config/ConfigReader";
import { DataBuffer } from "./sync/DataBuffer";
import { SyncService } from "./sync/SyncService";
import { UserGuard } from "./guards/UserGuard";
import { PauseController } from "./guards/PauseController";
import { WindowMonitor } from "./collectors/WindowMonitor";


// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * GIAI ĐOẠN 1: Khởi động.
 * Đọc config — nếu lỗi thì log rõ lý do và thoát ngay.
 * Không bao giờ để agent chạy với config không hợp lệ.
 */
async function bootstrap(): Promise<void> {
  console.log("=".repeat(60));
  console.log("[Agent] Parental Control Agent đang khởi động...");
  console.log(`[Agent] PID: ${process.pid}`);
  console.log(`[Agent] Node: ${process.version}`);
  console.log("=".repeat(60));

  // ── Đọc config ──────────────────────────────────────────────────────────────
  let configReader: ConfigReader | undefined;
  try {
    configReader = new ConfigReader();
    configReader.load();
    console.log("[Agent] ✓ Config đã load thành công.");
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[Agent] ✗ Lỗi config: ${err.message}`);
    } else {
      console.error(
        `[Agent] ✗ Lỗi không xác định khi đọc config: ${(err as Error).message}`,
      );
    }
    // Exit code 1 → node-windows / service manager biết cần alert
    process.exit(1);
  }

  // configReader luôn được gán ở đây vì nhánh lỗi đã exit(1)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const config = configReader!.get();

  // ── Khởi tạo các module (Dependency Injection thủ công) ─────────────────────

  // Tầng lưu trữ
  const dataBuffer = new DataBuffer(10_000);

  // Tầng thu thập
  const windowMonitor = new WindowMonitor();

  // Tầng kiểm soát
  const userGuard = new UserGuard({
    monitoredUsers: config.monitoredUsers,
    caseInsensitive: true,
  });

  const pauseController = new PauseController({ config });

  // Tầng đồng bộ (nhận DataBuffer qua DI)
  const syncService = new SyncService({ config, buffer: dataBuffer });

  // ── Đăng ký graceful shutdown ────────────────────────────────────────────────
  registerShutdownHandlers(syncService, pauseController);

  // ── Khởi động các service bất đồng bộ ───────────────────────────────────────

  // PauseController poll ngay lần đầu trước khi main loop bắt đầu
  // → đảm bảo trạng thái pause đúng từ tick đầu tiên
  await pauseController.start();

  // SyncService bắt đầu đếm ngược interval (không sync ngay)
  syncService.start();

  console.log("[Agent] ✓ Tất cả service đã sẵn sàng. Bắt đầu main loop...\n");

  // ── GIAI ĐOẠN 2: Main loop ───────────────────────────────────────────────────
  startMainLoop({
    config,
    dataBuffer,
    userGuard,
    pauseController,
    windowMonitor,
    syncService,
  });
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

interface MainLoopDependencies {
  config: ReturnType<ConfigReader["get"]>;
  dataBuffer: DataBuffer;
  userGuard: UserGuard;
  pauseController: PauseController;
  windowMonitor: WindowMonitor;
  syncService: SyncService;
}

/**
 * GIAI ĐOẠN 2: Main loop chạy mỗi 5s.
 *
 * Thứ tự kiểm tra:
 *  1. UserGuard  → sai user?    bỏ qua tick này.
 *  2. PauseCtrl  → đang pause?  bỏ qua tick này.
 *  3. Collectors → thu thập → nhét vào DataBuffer.
 *
 * Dùng setInterval (không phải recursive setTimeout) để đảm bảo
 * tần suất tick ổn định dù collector chạy lâu.
 */
function startMainLoop(deps: MainLoopDependencies): void {
  const {
    config,
    dataBuffer,
    userGuard,
    pauseController,
    windowMonitor,
  } = deps;

  // Dùng biến để tránh overlap tick (nếu collector chậm hơn interval)
  let isTickRunning = false;

  setInterval(async () => {
    // Bảo vệ: nếu tick trước chưa xong, bỏ qua tick này
    if (isTickRunning) {
      return;
    }
    isTickRunning = true;

    try {
      await runTick({
        dataBuffer,
        userGuard,
        pauseController,
        windowMonitor,
      });
    } catch (err) {
      // Lưới bắt cuối cùng — không bao giờ để crash agent
      console.error(
        `[MainLoop] Lỗi nghiêm trọng không xử lý được: ${(err as Error).message}`,
      );
    } finally {
      isTickRunning = false;
    }
  }, config.mainLoopIntervalMs);
}

// ─── Single Tick ──────────────────────────────────────────────────────────────

interface TickDependencies {
  dataBuffer: DataBuffer;
  userGuard: UserGuard;
  pauseController: PauseController;
  windowMonitor: WindowMonitor;
}

/**
 * Logic của một tick đơn — tách hàm riêng để dễ unit test.
 */
async function runTick(deps: TickDependencies): Promise<void> {
  const {
    dataBuffer,
    userGuard,
    pauseController,
    windowMonitor,
  } = deps;

  // ── Guard 1: Kiểm tra user ───────────────────────────────────────────────────
  if (!userGuard.isAllowed()) {
    // Silent skip — không log mỗi 5s để tránh spam
    return;
  }

  // ── Guard 2: Kiểm tra trạng thái pause ──────────────────────────────────────
  if (pauseController.getIsPaused()) {
    return;
  }

  // ── Collectors ───────────────────────────────────────────────────────────────

  // Thu thập thông tin cửa sổ đang active
  try {
    const windowEvent = await windowMonitor.collect();
    if (windowEvent !== null) {
      dataBuffer.push(windowEvent);
    }
  } catch (err) {
    console.error(`[Tick] WindowMonitor lỗi: ${(err as Error).message}`);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

/**
 * Đăng ký handler để khi agent bị dừng (Ctrl+C, service stop, kill...),
 * luôn flush buffer trước khi thoát → không mất data.
 */
function registerShutdownHandlers(
  syncService: SyncService,
  pauseController: PauseController,
): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    // Guard chống double-shutdown (SIGINT + SIGTERM cùng lúc)
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(
      `\n[Agent] Nhận tín hiệu ${signal}, đang shutdown gracefully...`,
    );

    // Dừng các interval trước
    pauseController.stop();
    syncService.stop();

    // Flush buffer lần cuối — cố gắng tốt nhất, không throw
    try {
      await syncService.flushNow();
      console.log("[Agent] ✓ Flush buffer hoàn tất.");
    } catch (err) {
      console.error(`[Agent] ✗ Flush cuối thất bại: ${(err as Error).message}`);
    }

    // Log stats trước khi thoát
    const stats = syncService.getStats();
    console.log(
      `[Agent] Stats cuối: synced=${stats.totalSynced} ` +
        `success=${stats.successCount} failure=${stats.failureCount}`,
    );

    console.log("[Agent] Goodbye.");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Bắt exception không xử lý — log và tiếp tục (không crash)
  process.on("uncaughtException", (err: Error) => {
    console.error(`[Agent] uncaughtException: ${err.message}\n${err.stack}`);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    console.error(`[Agent] unhandledRejection: ${String(reason)}`);
  });
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

bootstrap().catch((err: Error) => {
  console.error(`[Agent] Bootstrap thất bại nghiêm trọng: ${err.message}`);
  process.exit(1);
});
