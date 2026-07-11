import { GoogleGenerativeAI } from '@google/generative-ai';
import { UrlAnalysisModel } from './ai-analysis.model';
import { AiChatSessionModel } from './ai-chat.model';
import { sanitizeUrl, hashUrl } from '../../shared/utils/url.util';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Model mặc định — thay đổi sang gemini-2.5-flash vì 1.5 đã bị loại bỏ
const DEFAULT_MODEL = 'gemini-2.5-flash';

// Kiểm tra API key khi khởi động
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY chưa được cấu hình trong .env — AI features sẽ không hoạt động');
}

// Hàm lấy model: ưu tiên dùng mặc định, fallback sang query API nếu cần
async function getModelName(): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình. Hãy thêm key vào file .env của BE.');
  }
  // Dùng thẳng model mặc định — không cần gọi thêm API để list models
  return DEFAULT_MODEL;
}


export class AiService {
  async analyzeUrl(rawUrl: string) {
    const cleanUrl = sanitizeUrl(rawUrl);
    const urlHash = hashUrl(cleanUrl);

    const cachedAnalysis = await UrlAnalysisModel.findOne({ urlHash });
    if (cachedAnalysis) return cachedAnalysis;

    const prompt = `
      Bạn là một chuyên gia an toàn mạng cho trẻ em. Hãy phân tích URL sau: "${cleanUrl}".
      Trả về ĐÚNG định dạng JSON sau, không kèm bất kỳ văn bản nào khác:
      {
        "platformName": "Tên nền tảng (vd: YouTube, Discord)",
        "description": "Mô tả ngắn gọn nền tảng này làm gì",
        "mainActivities": ["Hoạt động 1", "Hoạt động 2"],
        "safetyLevel": "Safe hoặc Warning hoặc Danger",
        "parentAdvice": "Lời khuyên ngắn gọn cho phụ huynh khi con truy cập trang này"
      }
    `;

    try {
      const selectedModel = await getModelName();
      const model = genAI.getGenerativeModel({ model: selectedModel });
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`AI không trả về JSON hợp lệ: ${responseText}`);

      const aiData = JSON.parse(jsonMatch[0]);

      const validLevels = ['Safe', 'Warning', 'Danger'];
      if (!validLevels.includes(aiData.safetyLevel)) aiData.safetyLevel = 'Warning';

      const newAnalysis = await UrlAnalysisModel.create({ urlHash, cleanUrl, ...aiData });
      return newAnalysis;

    } catch (error: any) {
      console.error('================ LỖI TỪ GOOGLE API ================');
      console.error(error);
      throw new Error(`Lỗi gốc từ AI: ${error.message}`);
    }
  }

  async chatAboutUrl(parentId: string, rawUrl: string, userMessage: string) {
    const cleanUrl = sanitizeUrl(rawUrl);
    const urlHash = hashUrl(cleanUrl);

    let chatSession = await AiChatSessionModel.findOne({ parentId, urlHash });
    if (!chatSession) {
      chatSession = new AiChatSessionModel({ parentId, urlHash, messages: [] });
    }

    try {
      const selectedModel = await getModelName();
      const model = genAI.getGenerativeModel({ model: selectedModel });

      const history = [
        { role: 'user', parts: [{ text: `Ngữ cảnh: Chúng ta đang thảo luận về trang web ${cleanUrl}. Trả lời ngắn gọn, dễ hiểu cho phụ huynh.` }] },
        { role: 'model', parts: [{ text: 'Tôi đã hiểu.' }] },
        ...chatSession.messages.map(msg => ({
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
      ];

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      const aiResponseText = result.response.text();

      chatSession.messages.push({ role: 'user', content: userMessage, timestamp: new Date() });
      chatSession.messages.push({ role: 'ai', content: aiResponseText, timestamp: new Date() });
      await chatSession.save();

      return { reply: aiResponseText, history: chatSession.messages };
    } catch (error: any) {
      console.error('================ LỖI CHAT TỪ GOOGLE API ================');
      console.error(error);
      throw new Error(`Lỗi gốc từ AI (Chat): ${error.message}`);
    }
  }
}

export const aiService = new AiService();