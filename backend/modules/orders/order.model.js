import mongoose from 'mongoose';

export const ORDER_STATUS = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderItems: [
      {
        bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
        title: String, // snapshot để hiển thị khi sách bị sửa/xóa
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
    },
    paymentMethod: { type: String, enum: ['COD', 'Banking', 'Momo'], default: 'COD' },
    paymentResult: { id: String, status: String, updateTime: String },
    totalAmount: { type: Number, required: true },
    orderStatus: { type: String, enum: ORDER_STATUS, default: 'Pending' },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);