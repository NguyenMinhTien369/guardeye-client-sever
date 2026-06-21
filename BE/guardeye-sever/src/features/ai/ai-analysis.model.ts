import mongoose, { Schema, Document } from 'mongoose';

// Định nghĩa Interface cho TypeScript
export interface IUrlAnalysis extends Document {
  urlHash: string;         // Mã băm (SHA-256) của URL đã làm sạch để index và query cực nhanh
  cleanUrl: string;        // URL đã được làm sạch (vd: https://discord.com/channels)
  platformName: string;    // Tên nền tảng (Discord, Roblox,...)
  description: string;     // Mô tả ngắn gọn
  mainActivities: string[];// Các hoạt động chính (Nhắn tin, chơi game,...)
  safetyLevel: 'Safe' | 'Warning' | 'Danger'; // Mức độ an toàn
  parentAdvice: string;    // Lời khuyên cho phụ huynh
  createdAt: Date;
}

const UrlAnalysisSchema: Schema = new Schema({
  urlHash: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true // Đánh index để truy vấn siêu nhanh
  },
  cleanUrl: { type: String, required: true },
  platformName: { type: String, required: true },
  description: { type: String, required: true },
  mainActivities: { type: [String], default: [] },
  safetyLevel: { 
    type: String, 
    enum: ['Safe', 'Warning', 'Danger'], 
    required: true 
  },
  parentAdvice: { type: String, required: true },
}, {
  timestamps: true, // Tự động tạo createdAt, updatedAt
});

// THỦ THUẬT SENIOR: Thiết lập TTL (Time-To-Live) index
// Tự động xóa bản ghi này sau 30 ngày để nếu URL có thay đổi nội dung, AI sẽ được gọi lại để cập nhật.
UrlAnalysisSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const UrlAnalysisModel = mongoose.model<IUrlAnalysis>('UrlAnalysis', UrlAnalysisSchema);