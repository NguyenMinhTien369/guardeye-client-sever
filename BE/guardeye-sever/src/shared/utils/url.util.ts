import crypto from 'crypto';

/**
 * Làm sạch URL: Chỉ giữ lại Protocol, Domain và Path. Cắt bỏ toàn bộ Query parameters (?token=123)
 */
export const sanitizeUrl = (rawUrl: string): string => {
  try {
    const parsedUrl = new URL(rawUrl);
    // Ví dụ: https://discord.com/channels/123 -> Giữ nguyên
    // Ví dụ: https://game.com/play?session=abc -> Thành https://game.com/play
    return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
  } catch (error) {
    // Nếu URL không hợp lệ, trả về chuỗi gốc (hoặc handle lỗi tùy ý)
    return rawUrl;
  }
};

/**
 * Băm URL thành mã SHA-256 (Độ dài cố định 64 ký tự)
 */
export const hashUrl = (cleanUrl: string): string => {
  return crypto.createHash('sha256').update(cleanUrl).digest('hex');
};