import { Router } from "express";
import * as childrenController from "./children.controller";
import { validate, createChildSchema, updateChildSchema } from "./children.validation";
import { authenticate } from "../../shared/middlewares/auth.middleware";

// -----------------------------------------------------------------------------
// CHILDREN ROUTES
// Định nghĩa các api endpoint cho đối tượng trẻ em.
// -----------------------------------------------------------------------------

const router = Router();

// Tất cả các route /children đều cần authenticate
router.use(authenticate);

// POST /children/
router.post("/", validate(createChildSchema), childrenController.createChild);

// GET /children/
router.get("/", childrenController.getChildren);

// GET /children/:id
router.get("/:id", childrenController.getChildById);

// PUT /children/:id
router.put("/:id", validate(updateChildSchema), childrenController.updateChild);

// DELETE /children/:id
router.delete("/:id", childrenController.deleteChild);

export default router;
