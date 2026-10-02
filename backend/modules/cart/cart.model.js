import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        price: { type: Number, required: true }, // snapshot giá lúc thêm vào giỏ
      },
    ],
    totalPrice: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Tự tính lại tổng tiền mỗi lần lưu
cartSchema.pre('save', function () {
  this.totalPrice = this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
});

export default mongoose.model('Cart', cartSchema);