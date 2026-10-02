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
  },
  { timestamps: true }
);

bookSchema.index({ price: 1 });

// Giá thực tế người dùng phải trả
bookSchema.virtual('finalPrice').get(function () {
  return this.discountPrice ?? this.price;
});

export default mongoose.model('Book', bookSchema);