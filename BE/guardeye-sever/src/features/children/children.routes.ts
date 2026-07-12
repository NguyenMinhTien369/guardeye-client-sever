import { Router } from "express";
import * as childrenController from "./children.controller";
import { validate, createChildSchema, updateChildSchema } from "./children.validation";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { avatarUpload } from "./avatar.upload";

// -----------------------------------------------------------------------------
// CHILDREN ROUTES
// Định nghĩa các api endpoint cho đối tượng trẻ em.
// -----------------------------------------------------------------------------

const router = Router();

// Tất cả các route /children đều cần authenticate
router.use(authenticate);

// POST /children/
router.post("/", validate(createChildSchema), childrenController.create);

// GET /children/
router.get("/", childrenController.getAll);

// GET /children/:id
router.get("/:id", childrenController.getById);

// PUT /children/:id
router.put("/:id", validate(updateChildSchema), childrenController.update);

// POST /children/:id/avatar
router.post(
  "/:id/avatar",
  avatarUpload.single("avatar"),
  (req: any, res: any, next: any) => {
    next();
  },
  childrenController.uploadAvatar
);

// DELETE /children/:id
router.delete("/:id", childrenController.remove);

export default router;
