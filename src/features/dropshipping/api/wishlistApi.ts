import { apiClient } from '../../../api/client';
import {
  getDropshippingProductDetails,
  type DropshippingProduct,
} from './homeApi';

type DataRecord = Record<string, unknown>;

export type DropshippingWishlistProduct = Omit<DropshippingProduct, 'price'>;

function asRecord(value: unknown): DataRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as DataRecord
    : undefined;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function productId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const product = asRecord(value);
  return optionalText(product?._id) ?? optionalText(product?.id);
}

function imageList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function mapWishlistProduct(value: unknown): DropshippingWishlistProduct | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const rawProduct = row.product ?? row.productId ?? row;
  const product = asRecord(rawProduct);
  const id = productId(rawProduct) ?? productId(row._id);
  if (!id || !product) return undefined;

  const priceValue = product.dropshippingPrice;
  const dropshippingPrice =
    priceValue === null || priceValue === undefined || priceValue === ''
      ? undefined
      : Number(priceValue);
  const rawImages = product.images ?? product.image;
  const images = imageList(rawImages);
  const name = optionalText(product.productName) ?? optionalText(product.name);
  if (!name) return undefined;

  return {
    id,
    name,
    brand: optionalText(product.brand),
    dropshippingPrice:
      dropshippingPrice !== undefined && Number.isFinite(dropshippingPrice)
        ? dropshippingPrice
        : undefined,
    image: images[0],
    images,
  };
}

function findList(value: unknown, depth = 0): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (depth > 3) return undefined;
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of ['wishlist', 'items', 'products', 'data', 'results']) {
    const list = findList(record[key], depth + 1);
    if (list) return list;
  }
  return undefined;
}

function apiMessage(value: unknown, fallback: string): string {
  const root = asRecord(value);
  const data = asRecord(root?.data);
  const message = root?.message ?? data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function getDropshippingWishlist(): Promise<DropshippingWishlistProduct[]> {
  const { data } = await apiClient.get('/api/wishlist/');
  if (asRecord(data)?.success === false) {
    throw new Error(apiMessage(data, 'উইশলিস্ট লোড করা যায়নি।'));
  }
  const entries = findList(data);
  if (!entries) {
    throw new Error('সার্ভার থেকে উইশলিস্টের সঠিক তথ্য পাওয়া যায়নি।');
  }

  const products: DropshippingWishlistProduct[] = [];
  const missingDetailsIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const mapped = mapWishlistProduct(entry);
    if (mapped) {
      if (!seen.has(mapped.id)) {
        seen.add(mapped.id);
        products.push(mapped);
      }
      continue;
    }
    const row = asRecord(entry);
    const id = productId(row?.productId ?? row?.product);
    if (id && !seen.has(id)) {
      seen.add(id);
      missingDetailsIds.push(id);
    }
  }

  const detailedProducts = await Promise.all(
    missingDetailsIds.map((id) => getDropshippingProductDetails(id))
  );
  return [...products, ...detailedProducts];
}

export async function removeDropshippingWishlistProduct(productId: string): Promise<void> {
  const { data } = await apiClient.delete(
    `/api/wishlist/remove/${encodeURIComponent(productId)}`
  );
  if (asRecord(data)?.success === false) {
    throw new Error(apiMessage(data, 'উইশলিস্ট থেকে পণ্য সরানো যায়নি।'));
  }
}

export async function addDropshippingWishlistProduct(productId: string): Promise<void> {
  const { data } = await apiClient.post('/api/wishlist/add', { productId });
  if (asRecord(data)?.success === false) {
    throw new Error(apiMessage(data, 'পণ্যটি উইশলিস্টে যোগ করা যায়নি।'));
  }
}
