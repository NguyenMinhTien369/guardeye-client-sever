import crypto from 'crypto';

/**
 * Làm sạch URL: Chỉ giữ lại Protocol, Domain và Path. Cắt bỏ toàn bộ Query parameters (?token=123)
 */
export const sanitizeUrl = (rawUrl: string): string => {
  try {
    const parsedUrl = new URL(rawUrl);
    
    // Giữ lại các query param quan trọng định hình nội dung trang (vd: video youtube, từ khóa tìm kiếm)
    const searchParams = new URLSearchParams(parsedUrl.search);
    const keepParams = ['v', 'q', 'id', 'query'];
    const finalParams = new URLSearchParams();
    
    for (const p of keepParams) {
      if (searchParams.has(p)) {
        finalParams.set(p, searchParams.get(p)!);
      }
    }
    
    const query = finalParams.toString() ? `?${finalParams.toString()}` : '';
    return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}${query}`;
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