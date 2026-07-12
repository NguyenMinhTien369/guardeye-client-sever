import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// Đảm bảo thư mục tồn tại trước khi multer ghi file
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "avatars");
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
    // Tên file: <uuid>.<ext>
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

// -----------------------------------------------------------------------------
// FILE FILTER
// -----------------------------------------------------------------------------

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file JPG, PNG, WEBP"));
  }
};

// -----------------------------------------------------------------------------
// MULTER INSTANCE
// -----------------------------------------------------------------------------

export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB tối đa
    files: 1,                   // Chỉ 1 file mỗi request
  },
});
