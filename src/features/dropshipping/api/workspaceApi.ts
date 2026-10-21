import { apiClient } from '../../../api/client';

export type DropshippingWorkspaceRecord = Record<string, unknown>;

function record(value: unknown): DropshippingWorkspaceRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as DropshippingWorkspaceRecord
    : undefined;
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
  signal?: AbortSignal
): Promise<DropshippingWorkspaceRecord> {
  const { data } = await apiClient.get('/api/analytics/dropshipping/my-summary', { signal });
  const unwrapped = unwrapData(data);
  const summary = record(unwrapped);
  if (!summary) throw new Error('সার্ভার থেকে অ্যানালিটিক্সের সঠিক তথ্য পাওয়া যায়নি।');
  return summary;
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
