import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { ENV } from "./shared/config/env";
import { errorHandler } from "./shared/middlewares/error.middleware";
import { NotFoundError } from "./shared/core/error.response";
import router from "./routes/index";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.path.includes('/agent/screenshot')) return next();
  express.urlencoded({ extended: true })(req, res, next);
});

if (ENV.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Serve file ảnh đã upload — URL: /uploads/screenshots/<filename>
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/v1", router);

app.get("/health", (req, res) => {
  res.json({ success: true, statusCode: 200, message: "Server is running" });
});

// Bắt mọi request đến endpoint không tồn tại
app.use((req, res, next) => {
  next(new NotFoundError("Đường dẫn API không tồn tại", "ROUTE_NOT_FOUND"));
});

// Phải đặt CUỐI CÙNG
app.use(errorHandler);

export default app;
