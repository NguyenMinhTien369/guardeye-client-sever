import mongoose, { Schema, Document } from 'mongoose';

// Định nghĩa 1 tin nhắn
export interface IChatMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
}

// Định nghĩa Session chat
export interface IAiChatSession extends Document {
  parentId: mongoose.Types.ObjectId; // ID của phụ huynh đang chat
  urlHash: string;                   // Link mà phụ huynh đang hỏi tới
  messages: IChatMessage[];          // Mảng lịch sử tin nhắn
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema({
  role: { type: String, enum: ['user', 'ai', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false }); // Không cần sinh _id cho từng tin nhắn con

const AiChatSessionSchema: Schema = new Schema({
  parentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', // Reference tới collection Users (tài khoản phụ huynh)
    required: true,
    index: true
  },
  urlHash: { 
    type: String, 
    required: true,
    index: true 
  },
  messages: { 
    type: [ChatMessageSchema], 
    default: [] 
  }
}, {
  timestamps: true,
});

// Giới hạn thời gian lưu trữ lịch sử chat (ví dụ 7 ngày) để tránh phình to DB
AiChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const AiChatSessionModel = mongoose.model<IAiChatSession>('AiChatSession', AiChatSessionSchema);