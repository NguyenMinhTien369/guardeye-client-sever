// src/features/screenshot/screenshot.upload.ts

// -----------------------------------------------------------------------------
// SCREENSHOT UPLOAD CONFIG — Multer middleware cho file upload.
// Lưu file vào thư mục uploads/screenshots/ với tên UUID.
// Giới hạn: chỉ chấp nhận JPG/JPEG/PNG, tối đa 5MB mỗi ảnh.
// -----------------------------------------------------------------------------

import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// Đảm bảo thư mục tồn tại trước khi multer ghi file
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "screenshots");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// -----------------------------------------------------------------------------
// STORAGE ENGINE
// -----------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Tên file: <uuid>.<ext> — tránh trùng lặp và path traversal
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

// -----------------------------------------------------------------------------
// FILE FILTER
// -----------------------------------------------------------------------------

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/x-png"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file JPG hoặc PNG"));
  }
};

// -----------------------------------------------------------------------------
// MULTER INSTANCE
// -----------------------------------------------------------------------------

export const screenshotUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB tối đa mỗi ảnh
    files: 1,                   // Chỉ 1 file mỗi request
  },
});
