// Lỗi nghiệp vụ có thể dự đoán trước (operational error)
export default class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    // 4xx => 'fail' (lỗi từ client), 5xx => 'error' (lỗi server)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}