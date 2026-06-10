// src/features/agent/agent.middleware.ts

// -----------------------------------------------------------------------------
// AGENT MIDDLEWARE — xác thực X-Device-Token header/query param
// Tìm device trong DB, kiểm tra trạng thái, gắn vào req.device & req.ownerId
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import Device, { IDevice } from "../devices/devices.model";

// Mở rộng Express Request để thêm các trường agent-specific
declare global {
  namespace Express {
    interface Request {
      device?: IDevice;
      ownerId?: string;
    }
  }
}

/**
 * verifyDeviceToken — middleware xác thực Agent bằng device token.
 *
 * Lấy token theo thứ tự ưu tiên:
 *   1. Header X-Device-Token
 *   2. Query param ?deviceToken=<token>
 *
 * Kết quả:
 *   401 — thiếu token hoặc token không tìm thấy trong DB
 *   403 — device bị vô hiệu hóa (status = inactive)
 *   500 — lỗi DB không xác định
 *   next() — token hợp lệ → gắn req.device và req.ownerId
 *            (device pending tự động được chuyển → active)
 */
export async function verifyDeviceToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // 1. Lấy token từ header hoặc query
    const token =
      (req.headers["x-device-token"] as string | undefined) ||
      (req.query["deviceToken"] as string | undefined);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Device token không được cung cấp",
      });
      return;
    }

    // 2. Tra cứu device trong DB
    //    Dùng +deviceToken để override select:false — cần thiết cho query filter
    const device = await Device.findOne({ deviceToken: token }).select(
      "+deviceToken",
    );

    if (!device) {
      res.status(401).json({
        success: false,
        message: "Device token không hợp lệ",
      });
      return;
    }

    // 3. Kiểm tra trạng thái — chỉ chặn device bị vô hiệu hóa (inactive)
    //    pending → active: Agent lần đầu kết nối thành công tức là đã được cài
    if (device.status === "inactive") {
      res.status(403).json({
        success: false,
        message: "Thiết bị đã bị vô hiệu hóa",
      });
      return;
    }

    // 4. Tự động chuyển pending → active khi Agent kết nối lần đầu
    if (device.status === "pending") {
      // runValidators: false — tránh lỗi required validation trên deviceToken (select:false)
      await Device.findByIdAndUpdate(
        device._id,
        { status: "active" },
        { runValidators: false },
      );
      device.status = "active" as typeof device.status;
      console.log(`[verifyDeviceToken] Device ${device._id} pending → active`);
    }

    // 5. Gắn device và ownerId vào request cho các handler phía sau
    req.device = device;
    req.ownerId = (device.parentId as unknown as { toString: () => string })
      .toString();

    next();
  } catch (error) {
    console.error("[verifyDeviceToken] Lỗi không xác định:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi xác thực thiết bị. Vui lòng thử lại sau.",
    });
  }
}
