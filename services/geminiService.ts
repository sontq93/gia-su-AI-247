
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { Grade, Subject, UserSettings } from "../types";

// Hàm làm sạch văn bản khỏi các ký tự Markdown
const cleanMarkdown = (text: string) => {
  return text
    .replace(/[\*\#\_\~]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const getGeminiResponse = async (
  prompt: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  settings: UserSettings,
  subject: Subject,
  imageBase64?: string
) => {
  // Use process.env.API_KEY directly and create instance right before the call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    BẠN LÀ: Gia sư AI miền Bắc, đóng vai ${settings.teacherGender} cho học sinh ${settings.grade}.
    MÔN HỌC: ${subject}.
    XƯNG HÔ: "${settings.teacherGender}" - "${settings.addressMode}".

    QUY TẮC TỐI ƯU TOKENS & NỘI DUNG:
    1. KIẾN THỨC: Chuẩn xác 100% theo SGK Bộ GD&ĐT Việt Nam. Không nói kiến thức ngoài lề.
    2. NGẮN GỌN (CRITICAL): Trả lời súc tích nhất có thể. Chia nhỏ thành các đoạn 1-2 câu. Tổng độ dài câu trả lời nên dưới 100 chữ trừ khi giải toán phức tạp.
    3. CHỈ CHÈN ẢNH KHI CẦN: Chỉ dùng thẻ [IMAGE: description] khi giải thích khái niệm trừu tượng cần hình ảnh (VD: hình học, giải phẫu sinh học, bản đồ, thí nghiệm). Nếu là câu hỏi lý thuyết đơn giản hoặc tính toán số học, TUYỆT ĐỐI KHÔNG chèn ảnh.
    4. GỢI MỞ: Không đưa đáp án ngay. Đưa ra 1 gợi ý nhỏ hoặc 1 câu hỏi dẫn dắt để học sinh tự làm.
    5. ĐỊNH DẠNG: Văn bản thuần túy. Không Markdown. Dùng xuống dòng để phân tách ý.
  `;

  const contents = [...history.map(h => ({ role: h.role, parts: h.parts }))];
  const userPart: any = { text: prompt };
  const parts = [userPart];

  if (imageBase64) {
    parts.unshift({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(',')[1]
      }
    });
  }

  contents.push({ role: 'user', parts });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents,
    config: {
      systemInstruction,
      temperature: 0.1, // Thấp hơn để tăng tính chính xác và ngắn gọn
      tools: [{ googleSearch: {} }],
    },
  });

  return {
    text: cleanMarkdown(response.text || "Thầy/Cô chưa nghe rõ, con nói lại nhé."),
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};

export const generateIllustrativeImage = async (imagePrompt: string): Promise<string> => {
  // Use process.env.API_KEY directly and create instance right before the call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Educational illustration, simple style, clear for kids: ${imagePrompt}` }]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return "";
};

export const generateTTS = async (text: string, gender: 'Thầy' | 'Cô'): Promise<string> => {
  // Use process.env.API_KEY directly and create instance right before the call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const voiceName = gender === 'Thầy' ? 'Fenrir' : 'Kore';
  const textToSpeak = text.replace(/\[IMAGE:.*?\]/g, '').trim();
  const ttsPrompt = `Giọng miền Bắc, ấm áp, rành mạch: ${textToSpeak}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: ttsPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};
