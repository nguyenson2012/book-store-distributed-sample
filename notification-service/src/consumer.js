import amqplib from 'amqplib';

const EXCHANGE_NAME = 'bookstore_events';
const QUEUE_NAME = 'notification_service_queue';

// Routing keys mà service này lắng nghe
const ROUTING_KEYS = ['order.placed', 'order.delivered'];

/**
 * Khởi động RabbitMQ consumer
 * @param {Object} handlers - Map từ routing key đến handler function
 */
export const startConsumer = async (handlers) => {
  const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
  let reconnectTimer = null;

  const connect = async () => {
    let connection;
    let channel;

    try {
      connection = await amqplib.connect(rabbitUrl, { heartbeat: 30 });

      connection.on('error', (err) => {
        console.error('❌ [Consumer] RabbitMQ connection error:', err.message);
      });

      connection.on('close', () => {
        console.warn('⚠️  [Consumer] Kết nối RabbitMQ bị đóng. Đang thử kết nối lại sau 5s...');
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 5000);
        }
      });

      channel = await connection.createChannel();

      // Topic exchange: cho phép route event linh hoạt theo pattern
      await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

      // Queue bền vững: message không mất khi service restart
      const { queue } = await channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      // Bind tất cả routing key cần xử lý
      for (const key of ROUTING_KEYS) {
        await channel.bindQueue(queue, EXCHANGE_NAME, key);
      }

      // Xử lý tuần tự 1 message tại 1 thời điểm (tránh overload)
      channel.prefetch(1);

      console.log(`🐰 [Consumer] Đang lắng nghe queue: "${QUEUE_NAME}"`);
      console.log(`   Routing keys: ${ROUTING_KEYS.join(', ')}`);

      channel.consume(queue, async (msg) => {
        if (!msg) return;

        let routingKey = 'unknown';
        try {
          const parsed = JSON.parse(msg.content.toString());
          routingKey = parsed.routingKey;
          const { payload, timestamp } = parsed;

          console.log(`\n📥 [Consumer] Event nhận được: ${routingKey} (sent at ${timestamp})`);

          const handler = handlers[routingKey];
          if (handler) {
            await handler(payload);
          } else {
            console.warn(`⚠️ [Consumer] Không có handler cho "${routingKey}", bỏ qua.`);
          }

          // Xác nhận đã xử lý thành công → RabbitMQ xóa message khỏi queue
          channel.ack(msg);
        } catch (err) {
          console.error(`❌ [Consumer] Lỗi xử lý event "${routingKey}":`, err.message);
          channel.nack(msg, false, false); // false = không requeue
        }
      });

      // Graceful shutdown
      process.once('SIGINT', async () => {
        console.log('\n🛑 [Consumer] Đang đóng kết nối RabbitMQ...');
        try {
          if (channel) await channel.close();
          if (connection) await connection.close();
        } catch (_) {}
        process.exit(0);
      });

      return channel;
    } catch (err) {
      console.error('❌ [Consumer] Không kết nối được RabbitMQ:', err.message);
      console.error('   Thử kết nối lại sau 5s...');
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 5000);
      }
    }
  };

  await connect();
};
