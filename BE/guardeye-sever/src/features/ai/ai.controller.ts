import { Request, Response } from 'express';
import { aiService } from './ai.service';
import { OKResponse } from '../../shared/core/success.response'; 
import { BadRequestError } from '../../shared/core/error.response';

export class AiController {
  
  // POST /api/v1/ai/analyze-url
  static async analyzeUrl(req: Request, res: Response) {
    const { url } = req.body;
    
    if (!url) {
      throw new BadRequestError('URL is required');
    }

    const resultData = await aiService.analyzeUrl(url);

    // 2. Sử dụng OKResponse và truyền vào 'data' thay vì 'metadata'
    return new OKResponse({
      message: 'Phân tích URL thành công',
      data: resultData 
    }).send(res);
  }

  // POST /api/v1/ai/chat
  static async chat(req: Request, res: Response) {
    const { url, message } = req.body;
    
    const parentId = (req as any).user?.id || 'temp-parent-id'; 

    if (!url || !message) {
      throw new BadRequestError('URL và message là bắt buộc');
    }

    const resultData = await aiService.chatAboutUrl(parentId, url, message);

    // 3. Tương tự, dùng OKResponse
    return new OKResponse({
      message: 'AI đã phản hồi',
      data: resultData
    }).send(res);
  }
}