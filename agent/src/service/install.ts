import { Service } from "node-windows";
import * as path from "path";
import * as fs from "fs";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_NAME = "ParentalControlAgent";
const SERVICE_DESCRIPTION =
  "Parental Control Agent – thu thập lịch sử web và hoạt động cửa sổ.";

/**
 * Entry point của agent sau khi được compile bởi pkg/nexe.
 * pkg đóng gói toàn bộ thành một file .exe đặt cạnh install.js.
 */
const AGENT_SCRIPT = path.resolve(__dirname, "..", "index.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    console.error(`[Install] Không tìm thấy file: ${filePath}`);
    console.error(
      `[Install] Hãy chạy "npm run build" trước khi cài đặt service.`,
    );
    process.exit(1);
  }
}

function createService(): Service {
  const svc = new Service({
    name: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
    script: AGENT_SCRIPT,

    // Tự động restart nếu crash — tối đa 3 lần trong 60 giây
    maxRestarts: 3,
    maxRetries: 3,
    wait: 2, // Chờ 2 giây trước khi restart
    grow: 0.5, // Tăng thời gian chờ theo hệ số 0.5 mỗi lần retry

    // Ghi log ra thư mục cạnh script
    logpath: path.resolve(__dirname, "..", "..", "logs"),

    env: [
      {
        name: "NODE_ENV",
        value: "production",
      },
    ],
  });

  // logOnAs là property trên instance Service, không phải trong ServiceConfig
  svc.logOnAs = {
    account: "LocalSystem",
    domain: "",
    password: "",
  };

  return svc;
}

// ─── Install ──────────────────────────────────────────────────────────────────

function install(): void {
  assertFileExists(AGENT_SCRIPT);

  const svc = createService();

  svc.on("install", () => {
    console.log(`[Install] ✓ Service "${SERVICE_NAME}" đã được cài đặt.`);
    console.log(`[Install] Đang khởi động service...`);
    svc.start();
  });

  svc.on("start", () => {
    console.log(
      `[Install] ✓ Service "${SERVICE_NAME}" đã khởi động thành công.`,
    );
    console.log(
      `[Install] Kiểm tra trạng thái: services.msc hoặc sc query "${SERVICE_NAME}"`,
    );
  });

  svc.on("alreadyinstalled", () => {
    console.warn(
      `[Install] Service "${SERVICE_NAME}" đã được cài đặt trước đó.`,
    );
    console.warn(`[Install] Chạy "node install.js uninstall" để gỡ trước.`);
  });

  svc.on("error", (err: Error) => {
    console.error(`[Install] ✗ Lỗi: ${err.message}`);
    process.exit(1);
  });

  console.log(`[Install] Đang cài đặt service "${SERVICE_NAME}"...`);
  svc.install();
}

// ─── Uninstall ────────────────────────────────────────────────────────────────

function uninstall(): void {
  const svc = createService();

  svc.on("uninstall", () => {
    console.log(`[Uninstall] ✓ Service "${SERVICE_NAME}" đã được gỡ cài đặt.`);
  });

  svc.on("notinstalled", () => {
    console.warn(`[Uninstall] Service "${SERVICE_NAME}" chưa được cài đặt.`);
  });

  svc.on("error", (err: Error) => {
    console.error(`[Uninstall] ✗ Lỗi: ${err.message}`);
    process.exit(1);
  });

  console.log(`[Uninstall] Đang dừng và gỡ service "${SERVICE_NAME}"...`);
  svc.uninstall();
}

// ─── Status ───────────────────────────────────────────────────────────────────

function status(): void {

  // node-windows không có API status trực tiếp —
  // dùng sc.exe để query nhanh
  const { execSync } =
    require("child_process") as typeof import("child_process");

  try {
    const output = execSync(`sc query "${SERVICE_NAME}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stateMatch = output.match(/STATE\s*:\s*\d+\s+(\w+)/);
    const state = stateMatch?.[1] ?? "UNKNOWN";

    console.log(`[Status] Service "${SERVICE_NAME}": ${state}`);
  } catch {
    console.log(`[Status] Service "${SERVICE_NAME}": NOT INSTALLED`);
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

/**
 * Cách dùng (chạy với quyền Administrator):
 *   node install.js install    — Cài đặt và khởi động service
 *   node install.js uninstall  — Dừng và gỡ service
 *   node install.js status     — Kiểm tra trạng thái
 */
const command = process.argv[2]?.toLowerCase();

switch (command) {
  case "install":
    install();
    break;

  case "uninstall":
    uninstall();
    break;

  case "status":
    status();
    break;

  default:
    console.log(
      `
Parental Control Agent – Quản lý Windows Service

Cách dùng (phải chạy với quyền Administrator):
  node install.js install    Cài đặt và khởi động service
  node install.js uninstall  Dừng và gỡ service
  node install.js status     Kiểm tra trạng thái hiện tại

Service name: ${SERVICE_NAME}
Script path:  ${AGENT_SCRIPT}
    `.trim(),
    );
    break;
}
