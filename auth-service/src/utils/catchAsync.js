// Bọc async handler để không cần try/catch lặp lại; lỗi tự chuyển sang next()
export default (fn) => (req, res, next) => fn(req, res, next).catch(next);