import amqplib from 'amqplib';

const EXCHANGE_NAME = 'bookstore_events';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

let channel = null;
let connection = null;
let reconnectTimer = null;

/**
 * Kết nối RabbitMQ. Tự động retry khi mất kết nối.
 * Gọi 1 lần duy nhất khi server khởi động.
 */
export const connectRabbitMQ = async () => {
  try {
    connection = await amqplib.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Topic exchange — durable: không mất khi RabbitMQ restart
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    console.log('🐰 RabbitMQ connected →', RABBITMQ_URL.replace(/:[^:@]+@/, ':****@'));

    connection.on('error', (err) => {
      console.error('❌ RabbitMQ connection error:', err.message);
    });

    connection.on('close', () => {
      console.warn('⚠️  RabbitMQ connection closed. Reconnecting in 5s...');
      channel = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectRabbitMQ();
        }, 5000);
      }
    });
  } catch (err) {
    console.error('❌ RabbitMQ connect failed:', err.message);
    console.warn('   Monolith sẽ tiếp tục chạy, events sẽ bị bỏ qua cho đến khi reconnect.');
    // Retry sau 5s — monolith KHÔNG crash khi RabbitMQ down
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectRabbitMQ();
      }, 5000);
    }
  }
};

/**
 * Publish một domain event lên RabbitMQ
 * @param {string} routingKey - ví dụ: 'order.placed', 'order.delivered'
 * @param {Object} payload    - dữ liệu event
 * @returns {boolean} true nếu publish thành công
 */
export const publishEvent = (routingKey, payload) => {
  if (!channel) {
    console.warn(`⚠️  [RabbitMQ] Channel chưa sẵn sàng, bỏ qua event: ${routingKey}`);
    return false;
  }
  try {
    const message = JSON.stringify({
      routingKey,
      payload,
      timestamp: new Date().toISOString(),
    });
    // persistent: true → message không mất khi RabbitMQ restart
    channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(message), { persistent: true });
    console.log(`📤 [RabbitMQ] Event published: ${routingKey}`);
    return true;
  } catch (err) {
    console.error(`❌ [RabbitMQ] Publish thất bại (${routingKey}):`, err.message);
    return false;
  }
};
