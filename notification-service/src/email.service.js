import nodemailer from 'nodemailer';

let _transport = null;

/**
 * Tạo nodemailer transport.
 * - Production: Brevo SMTP (EMAIL_HOST=smtp-relay.brevo.com)
 * - Dev fallback: Ethereal (không cần cấu hình gì)
 */
const getTransport = async () => {
  if (_transport) return _transport;

  if (process.env.EMAIL_HOST) {
    // Brevo SMTP (hoặc bất kỳ SMTP nào)
    _transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,   // email đăng ký Brevo
        pass: process.env.EMAIL_PASS,   // SMTP Key của Brevo (không phải password Brevo)
      },
    });
    console.log(`📧 [EmailService] Using SMTP: ${process.env.EMAIL_HOST}`);
  } else {
    // Dev: Ethereal (email giả, xem preview URL trong console)
    const testAccount = await nodemailer.createTestAccount();
    _transport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('📧 [EmailService] Using Ethereal (dev). Account:', testAccount.user);
  }
  return _transport;
};

const fromAddress = () => process.env.EMAIL_FROM || 'BookStore <noreply@bookstore.dev>';

const sendEmail = async ({ to, subject, html }) => {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from: fromAddress(),
    to,
    subject,
    html,
  });

  if (!process.env.EMAIL_HOST) {
    // Dev: in link xem email giả
    console.log(`📧 [EmailService] Ethereal preview: ${nodemailer.getTestMessageUrl(info)}`);
  } else {
    console.log(`📧 [EmailService] Sent email via ${process.env.EMAIL_HOST}: ${subject} → ${to}`);
  }
  return info;
};

/**
 * Gửi email xác nhận đăng ký
 */
export const sendVerificationEmail = async (toEmail, verifyUrl) => {
  return sendEmail({
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
            Cảm ơn bạn đã đăng ký tài khoản tại BookStore! Vui lòng click vào nút bên dưới để xác nhận email.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
              ✅ Xác nhận Email
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 14px;">Link này hết hạn sau <strong>24 giờ</strong>.</p>
        </div>
      </div>
    `,
  });
};

/**
 * Gửi email thông báo đơn hàng giao thành công
 */
export const sendOrderDeliveredEmail = async ({ toEmail, userName, order }) => {
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

  return sendEmail({
    to: toEmail,
    subject: `[BookStore] Đơn hàng #${orderId} đã được giao thành công 🎉`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px;">📚 BookStore</h1>
          <p style="color: #ecfdf5; margin: 8px 0 0 0; font-size: 15px;">Thông báo giao hàng thành công</p>
        </div>
        <div style="background: #ffffff; padding: 32px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 20px;">Đơn hàng đã được giao thành công!</h2>
          <p style="color: #64748b; margin: 0; font-size: 14px;">Mã đơn hàng: <strong style="color: #0f172a;">#${orderId}</strong></p>

          <p style="color: #334155; line-height: 1.6; font-size: 15px; margin-top: 20px;">
            Xin chào <strong>${userName}</strong>,
          </p>
          <p style="color: #475569; line-height: 1.6; font-size: 14px;">
            Đơn hàng của bạn đã được giao thành công. BookStore hy vọng bạn có trải nghiệm đọc sách tuyệt vời!
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <h3 style="color: #1e293b; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase;">📍 Thông tin người nhận</h3>
            <p style="color: #334155; margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${recipientName}${recipientPhone}</p>
            <p style="color: #64748b; margin: 0; font-size: 13px;">${shippingAddressText}</p>
          </div>

          <h3 style="color: #1e293b; margin: 24px 0 12px 0; font-size: 14px; text-transform: uppercase;">📦 Chi tiết đơn hàng</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left;">
                <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #475569;">Sản phẩm</th>
                <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #475569; text-align: center;">SL</th>
                <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #475569; text-align: right;">Giá</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 12px; text-align: right; font-size: 15px; font-weight: 600; color: #0f172a; border-top: 2px solid #e2e8f0;">Tổng thanh toán:</td>
                <td style="padding: 12px; text-align: right; font-size: 17px; font-weight: 700; color: #059669; border-top: 2px solid #e2e8f0;">${formattedAmount}đ</td>
              </tr>
            </tfoot>
          </table>

          <div style="text-align: center; margin: 32px 0 20px 0;">
            <a href="${orderDetailsUrl}"
               style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 13px 32px;
                      text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
              Xem đơn hàng tại BookStore
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 13px; text-align: center;">
            Cảm ơn bạn đã tin tưởng BookStore!
          </p>
        </div>
      </div>
    `,
  });
};

/**
 * Gửi email chào mừng khi đăng ký thành công (order.placed)
 */
export const sendOrderPlacedEmail = async ({ toEmail, userName, order }) => {
  const orderId = order._id || order.id || order.orderId;
  const formattedAmount = Number(order.totalAmount || 0).toLocaleString('vi-VN');
  const itemsCount = order.orderItems?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;

  return sendEmail({
    to: toEmail,
    subject: `[BookStore] Đặt hàng thành công - Đơn #${orderId} 🎉`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px;">📚 BookStore</h1>
          <p style="color: #ede9fe; margin: 8px 0 0 0; font-size: 15px;">Xác nhận đặt hàng thành công</p>
        </div>
        <div style="background: #ffffff; padding: 32px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="color: #334155; line-height: 1.6; font-size: 15px;">
            Xin chào <strong>${userName}</strong>,
          </p>
          <p style="color: #475569; line-height: 1.6; font-size: 14px;">
            Đơn hàng <strong>#${orderId}</strong> của bạn đã được đặt thành công!<br/>
            Tổng: <strong style="color: #6366f1;">${formattedAmount}đ</strong> · ${itemsCount} sản phẩm
          </p>
          <p style="color: #475569; font-size: 14px;">Chúng tôi sẽ thông báo khi đơn hàng được xử lý và giao đi.</p>
          <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 32px;">
            Cảm ơn bạn đã mua sắm tại BookStore!
          </p>
        </div>
      </div>
    `,
  });
};
