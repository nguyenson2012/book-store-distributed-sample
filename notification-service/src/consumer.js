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

  let connection;
  try {
    connection = await amqplib.connect(rabbitUrl);
  } catch (err) {
    console.error('❌ [Consumer] Không kết nối được RabbitMQ:', err.message);
    console.error('   Hãy chắc chắn RabbitMQ đang chạy. Xem README.md để biết cách khởi động.');
    throw err;
  }

  const channel = await connection.createChannel();

  // Topic exchange: cho phép route event linh hoạt theo pattern
  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  // Queue bền vững: message không mất khi service restart
  const { queue } = await channel.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: {
      // Dead-letter queue để xem messages bị lỗi (optional)
      // 'x-dead-letter-exchange': 'bookstore_dlx',
    },
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
      // Nack + requeue=true: đẩy lại queue để thử lại
      // Trong production nên dùng dead-letter queue để tránh infinite loop
      channel.nack(msg, false, false); // false = không requeue → tránh loop khi lỗi liên tục
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 [Consumer] Đang đóng kết nối RabbitMQ...');
    await channel.close();
    await connection.close();
    process.exit(0);
  });

  return channel;
};
