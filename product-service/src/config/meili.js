import { MeiliSearch } from 'meilisearch';

let client;
let index;

export const BOOKS_INDEX = process.env.MEILI_INDEX || 'books';

export const isMeiliEnabled = () => Boolean(process.env.MEILI_HOST);

export const getMeiliIndex = () => index;

export const connectMeili = async () => {
  if (!isMeiliEnabled()) {
    console.warn('⚠️  MEILI_HOST chưa cấu hình — search fallback MongoDB regex');
    return null;
  }

  client = new MeiliSearch({
    host: process.env.MEILI_HOST,
    apiKey: process.env.MEILI_MASTER_KEY,
  });
  index = client.index(BOOKS_INDEX);

  await index.updateSettings({
    searchableAttributes: ['title', 'author', 'description'],
    filterableAttributes: [
      'category',
      'price',
      'isFlashSale',
      'flashSaleStartMs',
      'flashSaleEndMs',
    ],
    sortableAttributes: ['price', 'title', 'createdAt', 'flashSaleEndMs'],
    displayedAttributes: ['id'],
  });

  console.log(`✅ Meilisearch: ${process.env.MEILI_HOST} index=${BOOKS_INDEX}`);
  return index;
};
