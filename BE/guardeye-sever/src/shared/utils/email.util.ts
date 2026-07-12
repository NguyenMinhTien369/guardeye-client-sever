import nodemailer from "nodemailer";

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Khởi tạo transporter với cấu hình từ biến môi trường
    // (Trong thực tế cần cấu hình SMTP như Gmail, SendGrid, Amazon SES, v.v.)
    // Ở đây sử dụng Gmail làm ví dụ.
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || "your-email@gmail.com",
        pass: process.env.EMAIL_PASS || "your-app-password",
      },
    });
  }

  /**
   * Gửi email chung
   */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"GuardEye System" <${process.env.EMAIL_USER || "your-email@gmail.com"}>`,
        to,
        subject,
        html,
      });
      console.log(`[EmailService] Đã gửi email tới ${to}`);
    } catch (error) {
      console.error(`[EmailService] Lỗi khi gửi email tới ${to}:`, error);
      // Không throw error để luồng đăng ký / quên mật khẩu không bị gián đoạn
      // do lỗi email (trong thực tế có thể tuỳ yêu cầu business)
    }
  }

  /**
   * Gửi email xác thực tài khoản (Verify Email)
   */
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const subject = "Xác thực địa chỉ email - GuardEye";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Xác thực tài khoản của bạn</h2>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại GuardEye.</p>
        <p>Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã xác nhận (OTP) dưới đây:</p>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${token}
        </div>
        <p>Mã này dùng để xác thực email của bạn.</p>
        <p>Trân trọng,<br>Đội ngũ GuardEye</p>
      </div>
    `;
    await this.sendEmail(to, subject, html);
  }

  /**
   * Gửi mã OTP khôi phục mật khẩu
   */
  async sendPasswordResetEmail(to: string, otp: string): Promise<void> {
    const subject = "Mã OTP khôi phục mật khẩu - GuardEye";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Khôi phục mật khẩu</h2>
        <p>Bạn đã yêu cầu khôi phục mật khẩu cho tài khoản GuardEye.</p>
        <p>Đây là mã OTP của bạn (có hiệu lực trong 15 phút):</p>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.</p>
        <p>Trân trọng,<br>Đội ngũ GuardEye</p>
      </div>
    `;
    await this.sendEmail(to, subject, html);
  }
}

export default new EmailService();
