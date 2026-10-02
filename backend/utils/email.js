import nodemailer from 'nodemailer';

const createTransporter = () => {
  // Ưu tiên SMTP thật (Gmail, SendGrid...), fallback về Ethereal (dev)
  if (process.env.EMAIL_HOST) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  // Không có cấu hình SMTP → dùng Ethereal (test account tự tạo)
  return null;
};

let etherealTransport = null;

const getTransport = async () => {
  if (process.env.EMAIL_HOST) return createTransporter();

  // Tạo Ethereal account một lần
  if (!etherealTransport) {
    const testAccount = await nodemailer.createTestAccount();
    etherealTransport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Ethereal email account:', testAccount.user);
  }
  return etherealTransport;
};

/**
 * Gửi email xác nhận đăng ký
 * @param {string} toEmail - địa chỉ email nhận
 * @param {string} verifyUrl - đường link xác nhận đầy đủ
 */
export const sendVerificationEmail = async (toEmail, verifyUrl) => {
  const transport = await getTransport();

  const info = await transport.sendMail({
    from: `"BookStore 📚" <${process.env.EMAIL_FROM || 'noreply@bookstore.dev'}>`,
    to: toEmail,
    subject: 'Xác nhận địa chỉ email của bạn',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📚 BookStore</h1>
        </div>
        <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Xác nhận email của bạn</h2>
          <p style="color: #6b7280; line-height: 1.6;">
            Cảm ơn bạn đã đăng ký tài khoản tại BookStore! Để hoàn tất quá trình đăng ký,
            vui lòng click vào nút bên dưới để xác nhận địa chỉ email của bạn.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
              ✅ Xác nhận Email
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.6;">
            Link này sẽ hết hạn sau <strong>24 giờ</strong>.
            Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #d1d5db; font-size: 12px; text-align: center;">
            Hoặc copy link sau vào trình duyệt:<br/>
            <a href="${verifyUrl}" style="color: #6366f1; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>
      </div>
    `,
  });

  // Với Ethereal: in link preview để dev xem email trong console
  if (!process.env.EMAIL_HOST) {
    console.log('📧 Email preview URL:', nodemailer.getTestMessageUrl(info));
  }

  return info;
};
