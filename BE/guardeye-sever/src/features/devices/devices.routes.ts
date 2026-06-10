import { Router } from "express";
import * as devicesController from "./devices.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";

// -----------------------------------------------------------------------------
// DEVICES ROUTES
// Định nghĩa các api endpoint cho thiết bị giám sát.
// Có 2 loại đường dẫn:
//   - /children/:childId/devices  → POST (tạo thiết bị cho một child cụ thể)
//   - /devices                    → GET, PATCH, DELETE (quản lý thiết bị)
// -----------------------------------------------------------------------------

// Router dùng cho /children/:childId/devices — mergeParams để lấy được :childId
export const devicesByChildRouter = Router({ mergeParams: true });
devicesByChildRouter.use(authenticate);

// POST /children/:childId/devices
devicesByChildRouter.post("/", devicesController.create);

// Router dùng cho /devices
const router = Router();
router.use(authenticate);

// GET /devices
router.get("/", devicesController.getAll);

// PATCH /devices/:id/pause
router.patch("/:id/pause", devicesController.pause);

// PATCH /devices/:id/resume
router.patch("/:id/resume", devicesController.resume);

// DELETE /devices/:id
router.delete("/:id", devicesController.remove);

export default router;
