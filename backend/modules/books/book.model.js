import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Sách phải có tên'], trim: true },
    author: { type: String, required: [true, 'Sách phải có tác giả'], trim: true },
    category: { type: String, required: [true, 'Sách phải có danh mục'], index: true },
    price: { type: Number, required: true, min: [0, 'Giá không được âm'] },
    discountPrice: {
      type: Number,
      validate: {
        // Giá khuyến mãi phải nhỏ hơn giá gốc
        validator: function (v) { return v == null || v < this.price; },
        message: 'discountPrice phải nhỏ hơn price',
      },
    },
    stock: { type: Number, required: true, min: [0, 'Tồn kho không được âm'], default: 0 },
    description: { type: String, trim: true },
    coverImage: { type: String, default: 'default-cover.jpg' },
    ratingsAverage: { type: Number, default: 0, min: 0, max: 5, set: (v) => Math.round(v * 10) / 10 },
    ratingsQuantity: { type: Number, default: 0 },
    // Trạng thái Flash Sale
    isFlashSale: { type: Boolean, default: false, index: true },
    flashSaleStartDate: { type: Date },
    flashSaleEndDate: { type: Date, index: true },
    flashSaleDiscount: { type: Number, default: 50, min: 1, max: 99 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bookSchema.index({ price: 1 });

// Kiểm tra flash sale có đang trong thời gian hiệu lực hay không
bookSchema.virtual('isFlashSaleActive').get(function () {
  if (!this.isFlashSale || !this.flashSaleEndDate) return false;
  const now = new Date();
  const start = this.flashSaleStartDate ? new Date(this.flashSaleStartDate) : null;
  const end = new Date(this.flashSaleEndDate);
  if (start && now < start) return false;
  return now <= end;
});

// Giá thực tế người dùng phải trả (ưu tiên giá Flash Sale giảm 50% nếu đang diễn ra)
bookSchema.virtual('finalPrice').get(function () {
  if (this.isFlashSaleActive) {
    const discount = this.flashSaleDiscount || 50;
    return Math.round(this.price * (1 - discount / 100));
  }
  return this.discountPrice ?? this.price;
});

export default mongoose.model('Book', bookSchema);