import { apiClient } from '../../../api/client';

export interface DropshippingOrderSummary {
  _id?: string;
  id?: string;
  orderId?: string;
  order_status?: string;
  payment_status?: string;
  totalAmt?: number;
  totalAmount?: number;
  totalPrice?: number;
  createdAt?: string;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function errorMessage(value: unknown, fallback: string): string {
  const root = asRecord(value);
  const response = asRecord(root?.response);
  const data = asRecord(response?.data);
  const message = data?.message ?? root?.message;
  const status = response?.status;
  if (status === 404) {
    return 'প্রোফাইল API route পাওয়া যায়নি (404)। API base URL এবং backend route configuration যাচাই করুন।';
  }
  return typeof message === 'string' && message.trim()
    ? message
    : value instanceof Error && value.message
      ? value.message
      : fallback;
}

export function dropshippingProfileErrorMessage(value: unknown, fallback: string): string {
  return errorMessage(value, fallback);
}

export async function getDropshippingOrders(
  signal?: AbortSignal
): Promise<DropshippingOrderSummary[]> {
  const { data } = await apiClient.get('/api/orders/my-orders', { signal });
  const root = asRecord(data);
  if (root?.success === false) {
    throw new Error(errorMessage(data, 'অর্ডারের তথ্য লোড করা যায়নি।'));
  }
  const body = asRecord(root?.data);
  const orders = Array.isArray(data)
    ? data
    : Array.isArray(root?.orders)
      ? root.orders
      : Array.isArray(root?.data)
        ? root.data
        : Array.isArray(body?.orders)
          ? body.orders
          : Array.isArray(body?.items)
            ? body.items
            : Array.isArray(body?.data)
              ? body.data
              : undefined;
  if (!orders) {
    throw new Error('সার্ভার থেকে অর্ডারের সঠিক তথ্য পাওয়া যায়নি।');
  }
  return orders.filter((order): order is DropshippingOrderSummary => Boolean(asRecord(order)));
}

export async function updateDropshippingUserImage(
  userId: string,
  image: FormData,
  type?: 'shopLogo'
): Promise<void> {
  const url = `/api/users/user-image/${encodeURIComponent(userId)}${type ? `?type=${type}` : ''}`;
  const { data } = await apiClient.put(url, image, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (asRecord(data)?.success === false) {
    throw new Error(errorMessage(data, 'ছবি আপলোড করা যায়নি।'));
  }
}
