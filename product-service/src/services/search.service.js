import { getMeiliIndex, isMeiliEnabled } from '../config/meili.js';

export const toMeiliDoc = (book) => {
  const obj = typeof book.toObject === 'function' ? book.toObject() : book;
  const start = obj.flashSaleStartDate ? new Date(obj.flashSaleStartDate).getTime() : 0;
  const end = obj.flashSaleEndDate ? new Date(obj.flashSaleEndDate).getTime() : 0;
  return {
    id: String(obj._id || obj.id),
    title: obj.title,
    author: obj.author,
    category: obj.category,
    price: obj.price,
    description: obj.description || '',
    isFlashSale: Boolean(obj.isFlashSale),
    flashSaleStartMs: start,
    flashSaleEndMs: end,
    createdAt: obj.createdAt ? new Date(obj.createdAt).getTime() : Date.now(),
  };
};

export const indexBook = async (book) => {
  if (!isMeiliEnabled()) return;
  try {
    await getMeiliIndex().addDocuments([toMeiliDoc(book)]);
  } catch (err) {
    console.error('Meili index failed:', err.message);
  }
};

export const indexBooks = async (books) => {
  if (!isMeiliEnabled() || !books.length) return;
  try {
    await getMeiliIndex().addDocuments(books.map(toMeiliDoc));
  } catch (err) {
    console.error('Meili bulk index failed:', err.message);
  }
};

export const removeFromIndex = async (id) => {
  if (!isMeiliEnabled()) return;
  try {
    await getMeiliIndex().deleteDocument(String(id));
  } catch (err) {
    console.error('Meili delete failed:', err.message);
  }
};

const escapeFilterValue = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const meiliSort = (sort) => {
  if (!sort) return ['createdAt:desc'];
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  const dir = sort.startsWith('-') ? 'desc' : 'asc';
  const allowed = { price: 'price', title: 'title', createdAt: 'createdAt' };
  const mapped = allowed[field];
  if (!mapped) return ['createdAt:desc'];
  return [`${mapped}:${dir}`];
};

export const searchBooks = async ({
  search = '',
  category,
  minPrice,
  maxPrice,
  flashSale,
  sort,
  offset,
  limit,
}) => {
  if (!isMeiliEnabled()) return null;

  const filters = [];
  if (category) filters.push(`category = "${escapeFilterValue(category)}"`);
  if (minPrice) filters.push(`price >= ${Number(minPrice)}`);
  if (maxPrice) filters.push(`price <= ${Number(maxPrice)}`);
  if (flashSale === 'true') {
    const now = Date.now();
    filters.push(`isFlashSale = true AND flashSaleEndMs > ${now} AND flashSaleStartMs <= ${now}`);
  }

  const result = await getMeiliIndex().search(search, {
    filter: filters.length ? filters.join(' AND ') : undefined,
    sort: meiliSort(sort),
    offset,
    limit,
    attributesToRetrieve: ['id'],
  });

  return {
    ids: result.hits.map((h) => h.id),
    estimatedTotal: result.estimatedTotalHits ?? result.hits.length,
  };
};
