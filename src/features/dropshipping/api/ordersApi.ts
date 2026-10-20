import { apiClient } from '../../../api/client';

export type DropshippingPaymentProvider = 'bkash' | 'nagad' | 'rocket' | 'upay';
export type DropshippingPaymentType = 'delivery' | 'full';
export type DropshippingPaymentMethod = 'manual' | 'cod';

export interface DropshippingCouponCartItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface CreateDropshippingOrderPayload {
  products: {
    productId: string;
    quantity: number;
    sellingPrice: number;
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
    country: 'Bangladesh';
    mobile: number;
  };
  payment_method: DropshippingPaymentMethod;
  payment_type: DropshippingPaymentType | 'cod';
  payment_details?: {
    transactionId?: string;
    manual?: {
      provider: DropshippingPaymentProvider;
      senderNumber: string;
      transactionId: string;
    };
  };
  appliedCoupon?: string;
}

export interface DropshippingOrderResult {
  orderId: string;
  paymentReference?: string;
  orderTotal?: number;
  paymentWarning?: string;
}

export interface DropshippingCouponResult {
  discountAmount: number;
  coupon: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export async function applyDropshippingCoupon(
  code: string,
  cartItems: DropshippingCouponCartItem[]
): Promise<DropshippingCouponResult> {
  if (!cartItems.length) {
    throw new Error('কুপন প্রয়োগের জন্য অন্তত একটি পণ্য যোগ করুন।');
  }
  const { data } = await apiClient.post<{
    success?: boolean;
    message?: string;
    discountAmount?: number | string;
    coupon?: unknown;
  }>('/api/coupon/apply-ds', {
    code,
    cartItems,
  });
  if (data.success === false) {
    throw new Error(data.message || 'কুপনটি প্রয়োগ করা যায়নি।');
  }

  const discountAmount = Number(data.discountAmount);
  const coupon = record(data.coupon);
  if (!Number.isFinite(discountAmount) || discountAmount < 0 || !coupon) {
    throw new Error('সার্ভার থেকে কুপনের সঠিক তথ্য পাওয়া যায়নি।');
  }

  return { discountAmount, coupon };
}

function responseError(value: unknown, fallback: string): string {
  const root = record(value);
  const response = record(root?.response);
  const data = record(response?.data);
  const message = data?.message ?? root?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function submitDropshippingManualPayment(
  orderId: string,
  provider: DropshippingPaymentProvider,
  senderNumber: string,
  transactionId: string
): Promise<void> {
  const { data } = await apiClient.post('/api/orders/manual-payment', {
    orderId,
    provider,
    senderNumber,
    transactionId,
  });
  if (record(data)?.success === false) {
    throw new Error(responseError(data, 'পেমেন্ট তথ্য জমা দেওয়া যায়নি।'));
  }
}

export async function createDropshippingOrder(
  payload: CreateDropshippingOrderPayload
): Promise<DropshippingOrderResult> {
  const { data } = await apiClient.post('/api/orders/manual', payload);
  const root = record(data);
  if (!root || root.success === false) {
    throw new Error(responseError(data, 'অর্ডার তৈরি করা যায়নি।'));
  }

  const order = record(root.data) ?? record(root.order) ?? root;
  const orderId = order._id ?? order.id ?? order.orderId ?? order.orderNumber;
  const displayOrderId = order.orderId ?? order.orderNumber ?? orderId;
  if (typeof orderId !== 'string' || !orderId.trim() ||
      typeof displayOrderId !== 'string' || !displayOrderId.trim()) {
    throw new Error('অর্ডার তৈরি হয়েছে, কিন্তু অর্ডার নম্বর পাওয়া যায়নি। আবার পাঠানোর আগে অর্ডার তালিকা যাচাই করুন।');
  }
  const total = Number(order.totalAmt ?? order.totalAmount ?? order.totalPrice);

  let paymentWarning: string | undefined;
  const manualPayment = payload.payment_details?.manual;
  if (
    payload.payment_method === 'manual' &&
    manualPayment &&
    order.payment_status !== 'submitted' &&
    order.payment_status !== 'paid'
  ) {
    try {
      await submitDropshippingManualPayment(
        orderId,
        manualPayment.provider,
        manualPayment.senderNumber,
        manualPayment.transactionId
      );
    } catch (error) {
      paymentWarning = responseError(error, 'অর্ডার হয়েছে, কিন্তু পেমেন্ট তথ্য জমা হয়নি।');
    }
  }

  return {
    orderId: displayOrderId,
    ...(typeof order._id === 'string' ? { paymentReference: order._id } : {}),
    ...(Number.isFinite(total) ? { orderTotal: total } : {}),
    paymentWarning,
  };
}
