// src/modules/auth/jwt.service.ts

import crypto from "crypto";
import authRepository from "../../features/auth/auth.repository";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../middlewares/auth.middleware";

// -----------------------------------------------------------------------------
// JWT SERVICE
// Đóng gói toàn bộ logic liên quan đến access token và refresh token.
//
// Phân công rõ ràng:
//   - authenticate.ts  — định nghĩa các helper sign/verify cấp thấp (stateless)
//   - jwt.service.ts   — orchestrate logic cấp cao: kết hợp sign/verify với DB
//
// Không xử lý HTTP request/response — đó là việc của Controller.
// -----------------------------------------------------------------------------

// Shape trả về khi issue token pair (login hoặc refresh)
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class JwtService {
  // ---------------------------------------------------------------------------
  // ISSUE TOKEN PAIR
  // ---------------------------------------------------------------------------

  /**
   * Tạo cặp access + refresh token mới và lưu tokenId vào DB.
   *
   * Được gọi tại 2 thời điểm:
   *   1. Login thành công
   *   2. Refresh token thành công (token rotation)
   *
   * Flow:
   *   1. Generate tokenId ngẫu nhiên — đây là "chìa khóa" để revoke từng thiết bị
   *   2. Sign access token (stateless, 15 phút)
   *   3. Sign refresh token kèm tokenId (7 ngày)
   *   4. Lưu tokenId vào DB — token cũ bị vô hiệu hóa ngay tại bước này
   */
  async issueTokenPair(userId: string): Promise<TokenPair> {
    // crypto.randomUUID() là cryptographically secure, không cần thêm package
    const tokenId = crypto.randomUUID();

    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(userId, tokenId);

    // Lưu vào DB — bất kỳ refresh token nào với tokenId cũ đều bị vô hiệu hóa
    await authRepository.saveRefreshTokenId(userId, tokenId);

    return { accessToken, refreshToken };
  }

  // ---------------------------------------------------------------------------
  // REFRESH TOKEN
  // ---------------------------------------------------------------------------

  /**
   * Xác thực refresh token và cấp lại cặp token mới (token rotation).
   *
   * Token rotation: mỗi lần refresh → cặp token cũ bị hủy, cặp mới được cấp.
   * Nếu attacker lấy được refresh token cũ → không dùng được vì tokenId đã đổi.
   *
   * Flow:
   *   1. Verify chữ ký JWT (hết hạn → throw luôn)
   *   2. Tìm user trong DB kèm refreshTokenId
   *   3. So sánh tokenId trong token với tokenId trong DB
   *      → Không khớp = token đã bị dùng trước đó (reuse attack) hoặc đã logout
   *   4. Cấp cặp token mới (tokenId mới, tokenId cũ bị ghi đè trong DB)
   *
   * @throws Error với message cụ thể để Controller map sang HTTP status code phù hợp
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // 1. Verify chữ ký và hạn dùng của refresh token
    //    verifyRefreshToken throw nếu token invalid hoặc expired — để lỗi bubble up tự nhiên
    const payload = verifyRefreshToken(refreshToken);

    // 2. Lấy user kèm refreshTokenId (select: false nên phải select tường minh)
    const user = await authRepository.findByIdWithRefreshTokenId(
      payload.userId,
    );

    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    if (!user.isActive) {
      throw new Error("Tài khoản đã bị vô hiệu hóa");
    }

    // 3. So sánh tokenId — đây là bước cốt lõi chống token reuse attack
    //    Nếu không khớp: có thể token cũ đang bị tái sử dụng sau khi đã rotation
    //    hoặc user đã logout → revoke toàn bộ token của user để an toàn tối đa
    if (!user.refreshTokenId || user.refreshTokenId !== payload.tokenId) {
      // Xóa refreshTokenId trong DB để vô hiệu hóa mọi refresh token còn lại
      await authRepository.clearRefreshTokenId(user._id.toString());
      throw new Error("Refresh token không hợp lệ hoặc đã được sử dụng");
    }

    // 4. Token hợp lệ → cấp cặp token mới, tokenId cũ bị thay thế trong DB
    return this.issueTokenPair(user._id.toString());
  }

  // ---------------------------------------------------------------------------
  // REVOKE (LOGOUT)
  // ---------------------------------------------------------------------------

  /**
   * Thu hồi refresh token của user — dùng khi logout.
   *
   * Sau khi gọi method này:
   *   - Refresh token hiện tại của user không còn dùng được
   *   - Access token vẫn còn hiệu lực đến khi hết hạn (15 phút)
   *     → Đây là trade-off chấp nhận được với stateless JWT
   *     → Nếu cần revoke ngay lập tức → cần Redis blacklist (làm sau)
   */
  async revokeRefreshToken(userId: string): Promise<void> {
    await authRepository.clearRefreshTokenId(userId);
  }
}

export default new JwtService();
