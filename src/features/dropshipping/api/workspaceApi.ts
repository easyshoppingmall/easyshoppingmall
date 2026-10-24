import { apiClient } from '../../../api/client';

export type DropshippingWorkspaceRecord = Record<string, unknown>;

export interface DropshippingAnalyticsTransaction {
  type: string;
  status: string;
  date: string;
  amount: number;
  orderId?: string;
  user?: string;
}

export interface DropshippingVideoReferral {
  buyerName: string;
  buyerEmail: string;
  courseTitle: string;
  createdAt: string;
  amount: number;
  bonusAmount: number;
  status: string;
}

export interface DropshippingOrderPipeline {
  pending?: number;
  processing?: number;
  shipped?: number;
  delivered?: number;
  [status: string]: number | undefined;
}

export interface DropshippingAnalyticsTotals extends DropshippingWorkspaceRecord {
  currentBalance?: number;
  totalProfit?: number;
  pendingProfit?: number;
  referralIncome?: number;
}

export interface DropshippingAnalyticsSummary extends DropshippingWorkspaceRecord {
  summary?: DropshippingAnalyticsTotals;
  transactions?: DropshippingAnalyticsTransaction[];
  videoReferrals?: DropshippingVideoReferral[];
  orderPipeline?: DropshippingOrderPipeline;
}

function record(value: unknown): DropshippingWorkspaceRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as DropshippingWorkspaceRecord
    : undefined;
}

function parseAnalyticsTransaction(value: unknown): DropshippingAnalyticsTransaction {
  const transaction = record(value);
  const amount = Number(transaction?.amount);
  if (
    typeof transaction?.type !== 'string' ||
    typeof transaction.status !== 'string' ||
    typeof transaction.date !== 'string' ||
    !transaction.date.trim() ||
    (typeof transaction.amount !== 'number' && typeof transaction.amount !== 'string') ||
    (typeof transaction.amount === 'string' && !transaction.amount.trim()) ||
    transaction.amount === null ||
    !Number.isFinite(amount)
  ) {
    throw new Error('সার্ভার থেকে ড্যাশবোর্ড লেনদেনের সঠিক তথ্য পাওয়া যায়নি।');
  }
  return {
    type: transaction.type,
    status: transaction.status,
    date: transaction.date,
    amount,
    ...(typeof transaction.orderId === 'string' ? { orderId: transaction.orderId } : {}),
    ...(typeof transaction.user === 'string' ? { user: transaction.user } : {}),
  };
}

function parseVideoReferral(value: unknown): DropshippingVideoReferral {
  const referral = record(value);
  const amount = Number(referral?.amount);
  const bonusAmount = Number(referral?.bonusAmount);
  if (
    typeof referral?.buyerName !== 'string' ||
    typeof referral.buyerEmail !== 'string' ||
    typeof referral.courseTitle !== 'string' ||
    typeof referral.createdAt !== 'string' ||
    typeof referral.status !== 'string' ||
    (typeof referral.amount !== 'number' && typeof referral.amount !== 'string') ||
    (typeof referral.bonusAmount !== 'number' && typeof referral.bonusAmount !== 'string') ||
    (typeof referral.amount === 'string' && !referral.amount.trim()) ||
    (typeof referral.bonusAmount === 'string' && !referral.bonusAmount.trim()) ||
    !Number.isFinite(amount) ||
    !Number.isFinite(bonusAmount)
  ) {
    throw new Error('সার্ভার থেকে ভিডিও রেফারেলের সঠিক তথ্য পাওয়া যায়নি।');
  }
  return {
    buyerName: referral.buyerName,
    buyerEmail: referral.buyerEmail,
    courseTitle: referral.courseTitle,
    createdAt: referral.createdAt,
    amount,
    bonusAmount,
    status: referral.status,
  };
}

function parseOrderPipeline(value: unknown): DropshippingOrderPipeline {
  const pipeline = record(value);
  if (!pipeline) {
    throw new Error('সার্ভার থেকে অর্ডার পাইপলাইনের সঠিক তথ্য পাওয়া যায়নি।');
  }
  return Object.entries(pipeline).reduce<DropshippingOrderPipeline>((result, [stage, stageValue]) => {
    const count = Number(stageValue);
    if (
      (typeof stageValue !== 'number' && typeof stageValue !== 'string') ||
      (typeof stageValue === 'string' && !stageValue.trim()) ||
      !Number.isFinite(count) ||
      count < 0
    ) {
      throw new Error('সার্ভার থেকে অর্ডার পাইপলাইনের সঠিক তথ্য পাওয়া যায়নি।');
    }
    result[stage] = count;
    return result;
  }, {});
}

function parseAnalyticsTotals(value: unknown): DropshippingAnalyticsTotals {
  const totals = record(value);
  if (!totals) {
    throw new Error('সার্ভার থেকে অ্যানালিটিক্স সারসংক্ষেপের সঠিক তথ্য পাওয়া যায়নি।');
  }
  const keys = ['currentBalance', 'totalProfit', 'pendingProfit', 'referralIncome'] as const;
  const parsed = { ...totals };
  for (const key of keys) {
    const metric = totals[key];
    if (metric === undefined || metric === null) continue;
    if (
      (typeof metric !== 'number' && typeof metric !== 'string') ||
      (typeof metric === 'string' && !metric.trim()) ||
      !Number.isFinite(Number(metric))
    ) {
      throw new Error('সার্ভার থেকে অ্যানালিটিক্স সারসংক্ষেপের সঠিক তথ্য পাওয়া যায়নি।');
    }
    parsed[key] = Number(metric);
  }
  return parsed as DropshippingAnalyticsTotals;
}

function getErrorMessage(value: unknown, fallback: string): string {
  const root = record(value);
  const response = record(root?.response);
  const data = record(response?.data);
  const message = data?.message ?? data?.error ?? root?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function unwrapData(value: unknown): unknown {
  const root = record(value);
  if (!root) return value;
  if (root.success === false) {
    throw new Error(getErrorMessage(value, 'সার্ভার থেকে তথ্য আনা যায়নি।'));
  }
  return root.data ?? root.summary ?? root.result ?? value;
}

export async function getDropshippingAnalytics(
  signal?: AbortSignal,
  range?: { startDate?: string; endDate?: string }
): Promise<DropshippingAnalyticsSummary> {
  const { data } = await apiClient.get('/api/analytics/dropshipping/my-summary', {
    signal,
    ...(range?.startDate || range?.endDate
      ? { params: { startDate: range.startDate, endDate: range.endDate } }
      : {}),
  });
  const unwrapped = unwrapData(data);
  const summary = record(unwrapped);
  if (!summary) throw new Error('সার্ভার থেকে অ্যানালিটিক্সের সঠিক তথ্য পাওয়া যায়নি।');
  const transactions = summary.transactions === undefined || summary.transactions === null
    ? undefined
    : Array.isArray(summary.transactions)
      ? summary.transactions.map(parseAnalyticsTransaction)
      : (() => {
          throw new Error('সার্ভার থেকে ড্যাশবোর্ড লেনদেনের সঠিক তালিকা পাওয়া যায়নি।');
        })();
  const totals = summary.summary === undefined || summary.summary === null
    ? undefined
    : parseAnalyticsTotals(summary.summary);
  const videoReferrals = summary.videoReferrals === undefined || summary.videoReferrals === null
    ? undefined
    : Array.isArray(summary.videoReferrals)
      ? summary.videoReferrals.map(parseVideoReferral)
      : (() => {
          throw new Error('সার্ভার থেকে ভিডিও রেফারেলের সঠিক তালিকা পাওয়া যায়নি।');
        })();
  const orderPipeline = summary.orderPipeline === undefined || summary.orderPipeline === null
    ? undefined
    : parseOrderPipeline(summary.orderPipeline);
  return {
    ...summary,
    ...(totals ? { summary: totals } : {}),
    ...(transactions ? { transactions } : {}),
    ...(videoReferrals ? { videoReferrals } : {}),
    ...(orderPipeline ? { orderPipeline } : {}),
  };
}

export async function getDropshippingPaymentRequests(
  signal?: AbortSignal
): Promise<DropshippingWorkspaceRecord[]> {
  const { data } = await apiClient.get('/api/payment-request/my-requests', { signal });
  const unwrapped = unwrapData(data);
  const root = record(unwrapped);
  const list = Array.isArray(unwrapped)
    ? unwrapped
    : Array.isArray(root?.requests)
      ? root.requests
      : Array.isArray(root?.items)
        ? root.items
        : Array.isArray(root?.results)
          ? root.results
          : undefined;
  if (!list) throw new Error('সার্ভার থেকে পেমেন্ট অনুরোধের সঠিক তালিকা পাওয়া যায়নি।');
  return list.flatMap((item) => {
    const paymentRequest = record(item);
    return paymentRequest ? [paymentRequest] : [];
  });
}

export interface CreateDropshippingPaymentRequestPayload {
  amount: number;
  paymentMethod: string;
  accountNumber: string;
  number: string;
}

export async function createDropshippingPaymentRequest(
  payload: CreateDropshippingPaymentRequestPayload
): Promise<DropshippingWorkspaceRecord> {
  try {
    const { data } = await apiClient.post('/api/payment-request/create', payload);
    const root = record(data);
    if (root?.success === false) {
      throw new Error(getErrorMessage(data, 'পেমেন্ট অনুরোধ জমা দেওয়া যায়নি।'));
    }
    return record(root?.data) ?? record(root?.request) ?? root ?? {};
  } catch (error) {
    throw new Error(getErrorMessage(error, 'পেমেন্ট অনুরোধ জমা দেওয়া যায়নি।'));
  }
}
