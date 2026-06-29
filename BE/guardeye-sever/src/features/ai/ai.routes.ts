import { Router } from 'express';
import { AiController } from './ai.controller';
import { analyzeUrlSchema, chatSchema, validate } from './ai.validation';

// 1. Đổi tên import thành authenticate
import { authenticate } from '../../shared/middlewares/auth.middleware';

const router = Router();

// API: Phân tích URL
router.post(
  '/analyze-url',
  authenticate, // 2. Đổi ở đây
  validate(analyzeUrlSchema),
  AiController.analyzeUrl 
);

// API: Chat với AI
router.post(
  '/chat',
  authenticate, // 3. Đổi ở đây
  validate(chatSchema),
  AiController.chat 
);

export default router;