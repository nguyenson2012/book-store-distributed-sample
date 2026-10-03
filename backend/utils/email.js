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

/**
 * Gửi email thông báo đơn hàng đã giao thành công
 * @param {Object} options
 * @param {string} options.toEmail - địa chỉ email nhận
 * @param {string} options.userName - tên người nhận
 * @param {Object} options.order - thông tin đơn hàng
 */
export const sendOrderDeliveredEmail = async ({ toEmail, userName, order }) => {
  const transport = await getTransport();

  const orderId = order._id || order.id;
  const formattedAmount = Number(order.totalAmount || 0).toLocaleString('vi-VN');
  const items = order.orderItems || [];
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const orderDetailsUrl = `${clientUrl}/profile`;

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px;">
          ${item.title || 'Sách'}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b; font-size: 14px;">
          ${item.quantity || 1}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #1e293b; font-size: 14px; font-weight: 500;">
          ${Number(item.price || 0).toLocaleString('vi-VN')}đ
        </td>
      </tr>
    `
    )
    .join('');

  const shipping = order.shippingAddress || {};
  const shippingAddressText =
    [shipping.street, shipping.city].filter(Boolean).join(', ') || 'Địa chỉ đã đăng ký';
  const recipientName = shipping.fullName || userName || 'Quý khách';
  const recipientPhone = shipping.phone ? ` - ${shipping.phone}` : '';

  const info = await transport.sendMail({
    from: `"BookStore 📚" <${process.env.EMAIL_FROM || 'noreply@bookstore.dev'}>`,
    to: toEmail,
    subject: `[BookStore] Đơn hàng #${orderId} đã được giao thành công 🎉`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: -0.5px;">📚 BookStore</h1>
          <p style="color: #ecfdf5; margin: 8px 0 0 0; font-size: 15px;">Thông báo giao hàng thành công</p>
        </div>
        
        <div style="background: #ffffff; padding: 32px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: #d1fae5; color: #059669; font-size: 28px; margin-bottom: 12px;">
              ✓
            </div>
            <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 20px;">Đơn hàng đã được giao thành công!</h2>
            <p style="color: #64748b; margin: 0; font-size: 14px;">Mã đơn hàng: <strong style="color: #0f172a;">#${orderId}</strong></p>
          </div>

          <p style="color: #334155; line-height: 1.6; font-size: 15px;">
            Xin chào <strong>${userName}</strong>,
          </p>
          <p style="color: #475569; line-height: 1.6; font-size: 14px;">
            Đơn hàng của bạn đã được giao thành công đến địa chỉ người nhận. BookStore hy vọng bạn sẽ có những trải nghiệm đọc sách thật tuyệt vời!
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <h3 style="color: #1e293b; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">📍 Thông tin người nhận</h3>
            <p style="color: #334155; margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">
              ${recipientName}${recipientPhone}
            </p>
            <p style="color: #64748b; margin: 0; font-size: 13px; line-height: 1.5;">
              ${shippingAddressText}
            </p>
          </div>

          <h3 style="color: #1e293b; margin: 24px 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">📦 Chi tiết đơn hàng</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left;">
                <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #475569; border-radius: 6px 0 0 6px;">Sản phẩm</th>
                <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #475569; text-align: center;">SL</th>
                <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #475569; text-align: right; border-radius: 0 6px 6px 0;">Giá</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 12px; text-align: right; font-size: 14px; color: #64748b;">Phương thức thanh toán:</td>
                <td style="padding: 12px; text-align: right; font-size: 14px; color: #1e293b; font-weight: 500;">${order.paymentMethod || 'COD'}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 8px 12px; text-align: right; font-size: 15px; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">Tổng thanh toán:</td>
                <td style="padding: 8px 12px; text-align: right; font-size: 17px; font-weight: 700; color: #059669; border-top: 2px solid #e2e8f0;">${formattedAmount}đ</td>
              </tr>
            </tfoot>
          </table>

          <div style="text-align: center; margin: 32px 0 20px 0;">
            <a href="${orderDetailsUrl}"
               style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 13px 32px;
                      text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);">
              Xem đơn hàng tại BookStore
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
          <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
            Nếu bạn có bất kỳ câu hỏi nào về đơn hàng, vui lòng liên hệ đội ngũ hỗ trợ qua email hoặc hotline.<br/>
            Cảm ơn bạn đã tin tưởng và đồng hành cùng BookStore!
          </p>
        </div>
      </div>
    `,
  });

  // Với Ethereal: in link preview để dev xem email trong console
  if (!process.env.EMAIL_HOST) {
    console.log('📧 Order delivered email preview URL:', nodemailer.getTestMessageUrl(info));
  }

  return info;
};
