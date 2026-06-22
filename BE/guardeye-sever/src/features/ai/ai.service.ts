import { GoogleGenerativeAI } from '@google/generative-ai';
import { UrlAnalysisModel } from './ai-analysis.model';
import { AiChatSessionModel } from './ai-chat.model';
import { sanitizeUrl, hashUrl } from '../../shared/utils/url.util';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Hàm tự động dò tìm model khả dụng của tài khoản
async function getAvailableModelName(): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
  
  // Ép kiểu data thành any để TypeScript không báo lỗi đỏ
  const data: any = await response.json();

  if (data && data.error) {
    console.error("========== LÝ DO GOOGLE TỪ CHỐI KEY ==========");
    console.error(JSON.stringify(data.error, null, 2));
    console.error("================================================");
    throw new Error(`Google API từ chối Key: ${data.error.message}`);
  }

  // Lọc ra các model hỗ trợ tạo văn bản
  const validModels = data?.models?.filter((m: any) => 
    m.supportedGenerationMethods?.includes('generateContent')
  );

  if (!validModels || validModels.length === 0) {
    console.error("Chi tiết phản hồi từ Google:", data);
    throw new Error("Không tìm thấy model nào khả dụng cho Key này.");
  }

  // Ưu tiên chọn model flash hoặc pro
  const bestModel = validModels.find((m: any) => m.name.includes('flash') || m.name.includes('pro')) || validModels[0];
  const modelName = bestModel.name.replace('models/', '');
  
  console.log("🎯 Google cho phép bạn dùng Model:", modelName);
  return modelName;
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
      const selectedModel = await getAvailableModelName();
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
      const selectedModel = await getAvailableModelName();
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