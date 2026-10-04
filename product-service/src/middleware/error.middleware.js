import AppError from '../utils/AppError.js';

const handleCastError = (err) => new AppError(`Giá trị không hợp lệ ở ${err.path}: ${err.value}`, 400);
const handleDuplicate = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`${field} đã tồn tại`, 400);
};
const handleValidation = (err) =>
  new AppError(Object.values(err.errors).map((e) => e.message).join('. '), 400);
const handleJWT = () => new AppError('Token không hợp lệ hoặc đã hết hạn', 401);

export const notFound = (req, res, next) =>
  next(new AppError(`Không tìm thấy route ${req.originalUrl}`, 404));

export const errorHandler = (err, req, res, next) => {
  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.status = err.status || 'error';

  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicate(err);
  if (err.name === 'ValidationError') error = handleValidation(err);
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') error = handleJWT();

  if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    console.error('💥 UNEXPECTED ERROR:', err);
    return res.status(500).json({ status: 'error', message: 'Đã có lỗi xảy ra phía server' });
  }

  res.status(error.statusCode).json({
    status: error.status,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
