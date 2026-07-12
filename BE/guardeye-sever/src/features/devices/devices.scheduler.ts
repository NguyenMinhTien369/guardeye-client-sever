import cron from "node-cron";
import devicesRepository from "./devices.repository";

// -----------------------------------------------------------------------------
// DEVICES SCHEDULER
// Cron job tự động resume thiết bị khi pausedUntil đã hết hạn.
// Chỉ khởi động khi được gọi startAutoResumeJob() — không có side-effect khi import.
// -----------------------------------------------------------------------------

/**
 * Khởi động cron job tự động resume device khi `pausedUntil` hết hạn.
 *
 * - Chạy mỗi phút ("* * * * *").
 * - Tìm tất cả device có isPaused=true và pausedUntil <= now.
 * - Với mỗi device hết hạn, gọi resumeDevice() để reset trạng thái pause.
 * - Lỗi ở 1 device không làm dừng xử lý các device còn lại.
 *
 * Gọi hàm này ở entry point (index.ts) SAU KHI connectDB() thành công.
 */
export function startAutoResumeJob(): void {
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    // --- Query các device hết hạn ---
    let expired;
    try {
      expired = await devicesRepository.findExpiredPauses(now);
    } catch (err) {
      console.error("[AutoResume] Lỗi khi query expired pauses:", err);
      return; // Không tiếp tục nếu không query được — tránh undefined loop
    }

    if (expired.length === 0) return; // Không có gì để làm — thoát sớm

    console.log(
      `[AutoResume] Tìm thấy ${expired.length} device hết hạn pause — bắt đầu resume.`
    );

    // --- Resume từng device — lỗi 1 device không ảnh hưởng device khác ---
    for (const device of expired) {
      const deviceIdStr = device._id.toString();
      try {
        await devicesRepository.resumeDevice(deviceIdStr);
        console.log(`[AutoResume] ✓ Resume thành công device ${deviceIdStr}`);
      } catch (err) {
        console.error(
          `[AutoResume] ✗ Lỗi khi resume device ${deviceIdStr}:`,
          err
        );
        // Tiếp tục vòng lặp — không throw
      }
    }
  });

  console.log(
    "[AutoResume] Cron job đã khởi động — auto-resume device mỗi phút."
  );
}
