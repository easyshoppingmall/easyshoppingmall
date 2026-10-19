import { apiClient } from '../../../api/client';
import type { Product } from '../data/catalog';
import type { CartItem } from '../../../store/cartSlice';

export interface CreateOrderPayload {
  userId: string;
  products: {
    productId: string;
    name: string;
    image: string[];
    price: number;
    quantity: number;
    totalPrice: number;
    size?: string;
    color?: string;
    weight?: string;
  }[];
  delivery_address: {
    customer_name: string;
    address_line: string;
    district: string;
    division: string;
    upazila_thana: string;
    pincode: string;
    country: string;
    mobile: number | null;
  };
  deliveryCharge: number;
  subTotalAmt: number;
  totalAmt: number;
  payment_method: 'manual';
  payment_type: 'full' | 'delivery';
  payment_details: {
    transactionId: string;
    manual: {
      provider: 'bkash' | 'nagad';
      senderNumber: string;
      transactionId: string;
    };
  };
  appliedCoupon?: string | null;
  couponDiscount: number;
}

export interface ManualPaymentPayload {
  orderId: string;
  provider: 'bkash' | 'nagad';
  senderNumber: string;
  transactionId: string;
}

export interface CouponCartItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface ApplyCouponPayload {
  code: string;
  cartItems?: CouponCartItem[];
}

export interface Address {
  _id: string;
  address_line?: string;
  district?: string;
  division?: string;
  upazila_thana?: string;
  pincode?: string;
  country?: string;
  mobile?: string | number | null;
  status?: boolean;
  [key: string]: unknown;
}

export interface AddressPayload {
  address_line: string;
  district: string;
  division: string;
  upazila_thana: string;
  pincode: string;
  country: string;
  mobile: number | null;
}

export interface CustomerOrder {
  _id: string;
  id?: string;
  orderId?: string;
  orderNumber?: string;
  status?: string;
  order_status?: string;
  paymentStatus?: string;
  payment_status?: string;
  totalAmount?: number;
  totalPrice?: number;
  totalAmt?: number;
  createdAt?: string;
  items?: Record<string, unknown>[];
  products?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface BlogArticle {
  _id: string;
  title: string;
  author?: string;
  category?: string;
  image?: string;
  excerpt?: string;
  content?: string;
  createdDateBn?: string;
  createdAt?: string;
}

export interface WebsiteInfo {
  _id?: string;
  offerText?: string;
  deliveryText?: string;
  officeHours?: string;
  supportContact?: string;
  discountTitle?: string;
  discountLabel?: string;
  discountPercent?: number;
  discountLink?: string;
  address?: string;
  email?: string;
  number?: string;
  socialLinks?: Record<string, string>;
  [key: string]: unknown;
}

export interface ContactMessagePayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface ContactMessageResult {
  success: true;
  message?: string;
  emailNotificationSent?: boolean;
}

export interface Review {
  _id: string;
  rating?: number;
  comment?: string;
  review?: string;
  user?: string | { _id?: string; name?: string };
  createdAt?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function responseMessage(error: unknown, fallback: string): string {
  const value = asRecord(asRecord(error)?.response);
  const data = asRecord(value?.data);
  const errors = data?.errors;
  const validationMessages = Array.isArray(errors)
    ? errors.filter((item): item is string => typeof item === 'string').join('\n')
    : typeof errors === 'string'
      ? errors
      : undefined;
  const message = data?.message ?? data?.error ?? asRecord(data?.data)?.message;
  if (validationMessages?.trim()) return validationMessages;
  return typeof message === 'string' && message.trim()
    ? message
    : error instanceof Error && error.message
      ? error.message
      : fallback;
}

function extractList<T>(value: unknown): T[] {
  const root = asRecord(value);
  const nested = asRecord(root?.data);
  const list = Array.isArray(value)
    ? value
    : Array.isArray(root?.data)
      ? root.data
      : Array.isArray(nested?.items)
        ? nested.items
        : Array.isArray(nested?.data)
          ? nested.data
        : Array.isArray(root?.items)
          ? root.items
          : Array.isArray(nested?.cart)
            ? nested.cart
            : Array.isArray(nested?.products)
              ? nested.products
              : Array.isArray(root?.cart)
                ? root.cart
                : Array.isArray(root?.products)
                  ? root.products
                  : Array.isArray(root?.orders)
                    ? root.orders
                    : Array.isArray(root?.results)
              ? root.results
              : [];
  return list as T[];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function mapCartItems(value: unknown): CartItem[] {
  const collection = extractList<unknown>(value);

  return collection.flatMap((entry): CartItem[] => {
    const line = asRecord(entry);
    if (!line) return [];
    const product =
      asRecord(line.product) ??
      asRecord(line.productId) ??
      asRecord(line.productDetails) ??
      line;
    const id =
      text(product._id) ??
      text(product.id) ??
      text(line.productId) ??
      text(line.product) ??
      text(line._id);
    if (!id) return [];
    const imageValue = product.images ?? product.image;
    const image = Array.isArray(imageValue)
      ? text(imageValue[0]) ?? '🛍️'
      : text(imageValue) ?? '🛍️';
    const price = Number(product.price ?? line.price) || 0;
    return [{
      id,
      name: text(product.productName) ?? text(product.name) ?? 'পণ্য',
      price,
      originalPrice: Number(product.originalPrice) || undefined,
      image,
      category: text(asRecord(Array.isArray(product.category) ? product.category[0] : product.category)?.name) ?? 'অন্যান্য',
      quantity: Math.max(1, Number(line.quantity) || 1),
      selectedSize: text(line.size) ?? text(line.selectedSize),
      selectedColor: text(line.color) ?? text(line.selectedColor),
    }];
  });
}

export function mapWishlistProductIds(value: unknown): string[] {
  return extractList<unknown>(value).flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const product = asRecord(record.product) ?? asRecord(record.productId);
    const id = text(product?._id) ?? text(product?.id) ??
      text(record.productId) ?? text(record.product) ?? text(record._id) ?? text(record.id);
    return id ? [id] : [];
  });
}

export function mapWishlistProducts(value: unknown): Product[] {
  return extractList<unknown>(value).flatMap((entry): Product[] => {
    const row = asRecord(entry);
    if (!row) return [];
    const product = asRecord(row.product) ?? asRecord(row.productId) ?? row;
    const id = text(product._id) ?? text(product.id);
    if (!id) return [];
    const name = text(product.productName) ?? text(product.name) ?? 'পণ্য';
    const price = Number(product.price) || 0;
    const discountPercent = Math.max(0, Number(product.discount) || 0);
    const rawImages = product.images ?? product.image;
    const image = Array.isArray(rawImages)
      ? text(rawImages[0]) ?? '🛍️'
      : text(rawImages) ?? '🛍️';
    const categoryEntry = Array.isArray(product.category) ? asRecord(product.category[0]) : asRecord(product.category);
    return [{
      id,
      name,
      price,
      originalPrice: Number(product.originalPrice) || undefined,
      discount: discountPercent ? `${discountPercent}% ছাড়` : undefined,
      discountPercent,
      image,
      gallery: Array.isArray(rawImages) ? rawImages.filter((item): item is string => typeof item === 'string') : undefined,
      bgColor: '#E5F4FD',
      category: text(categoryEntry?.name) ?? 'অন্যান্য',
      rating: Number(product.ratings ?? product.rating) || undefined,
      stockCount: Number(product.productStock) || undefined,
      description: text(product.description),
    }];
  });
}

function extractOne<T>(value: unknown): T {
  const root = asRecord(value);
  const data = root?.data;
  const nested = asRecord(data);
  const result = nested?.data ?? nested?.item ?? nested?.order ?? nested?.address ?? data;
  return (result ?? root) as T;
}

function extractOrder(value: unknown): CustomerOrder {
  let current = asRecord(value);
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (
      current._id ||
      current.orderId ||
      Array.isArray(current.products) ||
      Array.isArray(current.items)
    ) {
      return current as CustomerOrder;
    }
    current =
      asRecord(current.data) ??
      asRecord(current.order) ??
      asRecord(current.result);
  }
  throw new Error('অর্ডারের তথ্য সঠিকভাবে পাওয়া যায়নি।');
}

function extractManualOrder(value: unknown): CustomerOrder {
  const root = asRecord(value);
  const candidates: (Record<string, unknown> | undefined)[] = [];
  let current = root;
  for (let depth = 0; current && depth < 4; depth += 1) {
    candidates.push(current);
    const next =
      asRecord(current.data) ??
      asRecord(current.order) ??
      asRecord(current.result);
    if (!next || next === current) break;
    current = next;
  }
  const order = candidates.find((candidate) =>
    candidate && (candidate._id || candidate.orderId || candidate.id || candidate.orderNumber)
  );
  if (!order) {
    throw new Error('অর্ডার তৈরি হয়েছে, কিন্তু সার্ভার অর্ডার আইডি দেয়নি। অর্ডার তালিকা যাচাই করুন।');
  }
  return order as CustomerOrder;
}

export const customerApi = {
  getAddresses: async (): Promise<Address[]> => {
    const { data } = await apiClient.get('/api/address/get');
    return extractList<Address>(data).filter((address) => address.status !== false);
  },
  createAddress: async (payload: AddressPayload): Promise<Address> => {
    const { data } = await apiClient.post('/api/address/create', payload);
    return extractOne<Address>(data);
  },
  updateAddress: async (payload: AddressPayload & { _id: string }): Promise<Address> => {
    const { data } = await apiClient.put('/api/address/update', payload);
    return extractOne<Address>(data);
  },
  disableAddress: async (addressId: string): Promise<void> => {
    await apiClient.delete('/api/address/disable', { data: { _id: addressId } });
  },
  getCategoryTree: async (): Promise<unknown> =>
    (await apiClient.get('/api/categories/get-tree')).data,
  getCategory: async (categoryId: string): Promise<unknown> =>
    (await apiClient.get(`/api/categories/${encodeURIComponent(categoryId)}`)).data,
  getSubcategory: async (subcategoryId: string): Promise<unknown> =>
    (await apiClient.get(`/api/subcategories/${encodeURIComponent(subcategoryId)}`)).data,
  searchProducts: async (payload: Record<string, unknown>): Promise<unknown> =>
    (await apiClient.post('/api/products/search-product', payload)).data,
  imageSearchProducts: async (payload: FormData | Record<string, unknown>): Promise<unknown> =>
    (await apiClient.post('/api/products/image-search', payload, {
      headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    })).data,
  updateUserImage: async (userId: string, payload: FormData, type?: 'shopLogo'): Promise<unknown> =>
    (await apiClient.put(`/api/users/user-image/${encodeURIComponent(userId)}${type ? `?type=${type}` : ''}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
  getCart: async (userId: string): Promise<unknown> => {
    const { data } = await apiClient.get(`/api/cart/${encodeURIComponent(userId)}`);
    return data;
  },
  addCartItem: async (payload: {
    userId: string;
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
  }): Promise<unknown> => (await apiClient.post('/api/cart/add', payload)).data,
  updateCartItem: async (payload: {
    userId: string;
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
  }): Promise<unknown> => (await apiClient.put('/api/cart/update', payload)).data,
  removeCartItem: async (userId: string, productId: string): Promise<void> => {
    await apiClient.delete(
      `/api/cart/remove/${encodeURIComponent(userId)}/${encodeURIComponent(productId)}`
    );
  },
  clearCart: async (userId: string): Promise<void> => {
    await apiClient.delete(`/api/cart/clear/${encodeURIComponent(userId)}`);
  },
  getWishlist: async (): Promise<unknown> => (await apiClient.get('/api/wishlist/')).data,
  addWishlistItem: async (productId: string): Promise<unknown> =>
    (await apiClient.post('/api/wishlist/add', { productId })).data,
  removeWishlistItem: async (productId: string): Promise<void> => {
    await apiClient.delete(`/api/wishlist/remove/${encodeURIComponent(productId)}`);
  },
  clearWishlist: async (): Promise<void> => {
    await apiClient.delete('/api/wishlist/clear');
  },
  getOrders: async (): Promise<CustomerOrder[]> => {
    const { data } = await apiClient.get('/api/orders/my-orders');
    return extractList<CustomerOrder>(data);
  },
  getOrder: async (orderId: string): Promise<CustomerOrder> => {
    const { data } = await apiClient.get(`/api/orders/${encodeURIComponent(orderId)}`);
    const response = asRecord(data);
    if (response?.success === false) {
      throw new Error(typeof response.message === 'string' ? response.message : 'অর্ডার লোড করা যায়নি।');
    }
    return extractOrder(data);
  },
  createOrder: async (payload: Record<string, unknown>): Promise<CustomerOrder> => {
    const { data } = await apiClient.post('/api/orders/create', payload);
    return extractOne<CustomerOrder>(data);
  },
  createManualOrder: async (payload: CreateOrderPayload): Promise<CustomerOrder> => {
    const { data } = await apiClient.post('/api/orders/manual', payload);
    if (asRecord(data)?.success === false) {
      const message = asRecord(data)?.message;
      throw new Error(typeof message === 'string' ? message : 'অর্ডার তৈরি করা যায়নি।');
    }
    return extractManualOrder(data);
  },
  submitManualPayment: async (payload: ManualPaymentPayload): Promise<CustomerOrder> => {
    const { data } = await apiClient.post('/api/orders/manual-payment', payload);
    if (asRecord(data)?.success === false) {
      const message = asRecord(data)?.message;
      throw new Error(typeof message === 'string' ? message : 'পেমেন্ট তথ্য জমা দেওয়া যায়নি।');
    }
    const order = asRecord(asRecord(data)?.order);
    return order ? order as CustomerOrder : extractManualOrder(data);
  },
  payOrderDue: async (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    (await apiClient.post(`/api/orders/${encodeURIComponent(orderId)}/pay-due`, payload)).data,
  initiatePayment: async (payload: Record<string, unknown>): Promise<unknown> =>
    (await apiClient.post('/api/payment/initiate', payload)).data,
  createPaymentRequest: async (payload: Record<string, unknown>): Promise<unknown> =>
    (await apiClient.post('/api/payment-request/create', payload)).data,
  getPaymentRequests: async (): Promise<unknown[]> => {
    const { data } = await apiClient.get('/api/payment-request/my-requests');
    return extractList<unknown>(data);
  },
  applyCoupon: async (payload: ApplyCouponPayload): Promise<unknown> => {
    const { data } = await apiClient.post('/api/coupon/apply', payload);
    if (asRecord(data)?.success === false) {
      const message = asRecord(data)?.message;
      throw new Error(typeof message === 'string' ? message : 'কুপনটি প্রয়োগ করা যায়নি।');
    }
    return data;
  },
  applyDropshippingCoupon: async (payload: ApplyCouponPayload): Promise<unknown> => {
    const { data } = await apiClient.post('/api/coupon/apply-ds', payload);
    if (asRecord(data)?.success === false) {
      const message = asRecord(data)?.message;
      throw new Error(typeof message === 'string' ? message : 'কুপনটি প্রয়োগ করা যায়নি।');
    }
    return data;
  },
  getProductCoupons: async (productId: string): Promise<unknown[]> => {
    const { data } = await apiClient.get(
      `/api/coupon/product/${encodeURIComponent(productId)}`
    );
    return extractList<unknown>(data);
  },
  getReviews: async (productId: string): Promise<Review[]> => {
    const { data } = await apiClient.get(`/api/review/${encodeURIComponent(productId)}`);
    return extractList<Review>(data);
  },
  createReview: async (
    productId: string,
    payload: { rating: number; comment: string }
  ): Promise<Review> => {
    const { data } = await apiClient.post(`/api/review/${encodeURIComponent(productId)}`, payload);
    return extractOne<Review>(data);
  },
  deleteReview: async (reviewId: string): Promise<void> => {
    await apiClient.delete(`/api/review/${encodeURIComponent(reviewId)}`);
  },
  getNotifications: async (): Promise<unknown[]> => {
    const { data } = await apiClient.get('/api/notification/');
    return extractList<unknown>(data);
  },
  markNotificationRead: async (notificationId: string): Promise<void> => {
    await apiClient.put(`/api/notification/${encodeURIComponent(notificationId)}/read`);
  },
  markAllNotificationsRead: async (): Promise<void> => {
    await apiClient.put('/api/notification/mark-all-read');
  },
  getBlogPosts: async (): Promise<BlogArticle[]> => {
    const { data } = await apiClient.get('/api/blog/get');
    return extractList<BlogArticle>(data);
  },
  getBlogPost: async (id: string): Promise<BlogArticle> => {
    const { data } = await apiClient.get(`/api/blog/${encodeURIComponent(id)}`);
    return extractOne<BlogArticle>(data);
  },
  getWebsiteInfo: async (): Promise<WebsiteInfo> => {
    const { data } = await apiClient.get('/api/websiteinfo/get');
    const first = extractList<WebsiteInfo>(data)[0];
    if (first) return first;
    return extractOne<WebsiteInfo>(data);
  },
  getHomepage: async (): Promise<unknown> => {
    const { data } = await apiClient.get('/api/homepage/');
    return extractOne(data);
  },
  getPopularProducts: async (payload: Record<string, unknown>): Promise<Product[]> => {
    const { data } = await apiClient.post('/api/homepage/popular-products', payload);
    return extractList<Product>(data);
  },
  sendContactMessage: async (
    payload: ContactMessagePayload
  ): Promise<ContactMessageResult> => {
    const { data } = await apiClient.post<ContactMessageResult | {
      success?: false;
      message?: string;
    }>('/api/contact/create', payload);
    if (data.success !== true) {
      throw new Error(data.message || 'বার্তাটি পাঠানো যায়নি। আবার চেষ্টা করুন।');
    }
    return data;
  },
  getReferralInfo: async (): Promise<unknown> =>
    (await apiClient.get('/api/referral/get')).data,
  getLeftBanners: async (): Promise<unknown[]> =>
    extractList((await apiClient.get('/api/LeftBanner/get')).data),
  getRightBanners: async (): Promise<unknown[]> =>
    extractList((await apiClient.get('/api/RightBanner/get')).data),
};
