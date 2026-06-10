// src/features/agent/agent.controller.ts

// -----------------------------------------------------------------------------
// AGENT CONTROLLER — nhận request từ Agent, gọi AgentService, trả response.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import agentService from "./agent.service";
import { SyncRequestDto } from "./agent.dto";
import { OKResponse } from "../../shared/core/success.response";
import {
  BadRequestError,
  AuthFailureError,
} from "../../shared/core/error.response";

// -----------------------------------------------------------------------------
// AGENT CONTROLLER HANDLERS
// -----------------------------------------------------------------------------

/**
 * POST /api/v1/agent/sync
 * Agent gửi batch events lên server.
 * Yêu cầu: X-Device-Token header đã được xác thực bởi verifyDeviceToken middleware.
 */
export const sync = async (
  req: Request<{}, {}, SyncRequestDto>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const deviceId = (req.device as any)._id.toString();
    const ownerId = req.ownerId!;

    const result = await agentService.syncEvents(req.body, deviceId, ownerId);

    new OKResponse({
      message: result.message || "Đồng bộ thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đồng bộ thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * GET /api/v1/agent/status
 * Agent poll trạng thái pause định kỳ.
 * Yêu cầu: X-Device-Token header đã được xác thực bởi verifyDeviceToken middleware.
 */
export const getStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.device) {
      next(new AuthFailureError("Device chưa được xác thực"));
      return;
    }

    const deviceId = (req.device as any)._id.toString();
    const result = await agentService.getAgentStatus(deviceId);

    new OKResponse({
      message: "Lấy trạng thái thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lấy trạng thái thất bại";
    next(new BadRequestError(message));
  }
};
