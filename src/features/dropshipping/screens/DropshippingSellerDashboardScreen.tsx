import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../../store/hooks';
import { colors } from '../../../shared/theme/colors';
import {
  formatDropshippingNumber,
  formatDropshippingTaka,
} from '../api/homeApi';
import type { DropshippingOrderSummary } from '../api/profileApi';
import type {
  DropshippingAnalyticsTransaction,
  DropshippingOrderPipeline,
} from '../api/workspaceApi';
import {
  useDropshippingAnalyticsQuery,
  useDropshippingOrdersQuery,
  useDropshippingProfileQuery,
} from '../api/queries';

type IconName = keyof typeof Ionicons.glyphMap;
type OrderRecord = DropshippingOrderSummary & Record<string, unknown>;

interface OrderCounts {
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  inProgress: number;
  delivered: number;
  returnedCancelled: number;
}

interface RevenuePoint {
  key: string;
  label: string;
  amount: number;
}

interface TopProduct {
  id: string;
  name: string;
  quantity: number;
}

const ORDER_STAGES: {
  key: keyof DropshippingOrderPipeline;
  label: string;
  color: string;
  tint: string;
}[] = [
  { key: 'pending', label: 'Pending', color: '#F59E0B', tint: '#FFF1E0' },
  { key: 'processing', label: 'Processing', color: '#0092EE', tint: '#E5F4FD' },
  { key: 'shipped', label: 'Shipped', color: '#7C3AED', tint: '#F3EBFB' },
  { key: 'delivered', label: 'Delivered', color: '#10B981', tint: '#EAF7EE' },
];

const DASHBOARD_METRICS: {
  key: keyof OrderCounts;
  title: string;
  icon: IconName;
  color: string;
  tint: string;
}[] = [
  { key: 'total', title: 'Total Orders', icon: 'receipt-outline', color: colors.primary, tint: colors.primaryLight },
  { key: 'pending', title: 'Pending Orders', icon: 'time-outline', color: '#B54708', tint: colors.tintOrange },
  { key: 'inProgress', title: 'In Progress', icon: 'sync-outline', color: '#6941C6', tint: colors.tintPurple },
  { key: 'delivered', title: 'Delivered', icon: 'checkmark-circle-outline', color: '#087443', tint: colors.tintGreen },
  { key: 'returnedCancelled', title: 'Returned/Cancelled', icon: 'arrow-undo-outline', color: '#B42318', tint: colors.tintPink },
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function displayText(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function numericValue(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizedStatus(order: OrderRecord): string {
  return displayText(order.order_status ?? order.status)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function countOrders(orders: readonly DropshippingOrderSummary[]): OrderCounts {
  const counts: OrderCounts = {
    total: orders.length,
    pending: 0,
    processing: 0,
    shipped: 0,
    inProgress: 0,
    delivered: 0,
    returnedCancelled: 0,
  };
  for (const item of orders) {
    const status = normalizedStatus(item as OrderRecord);
    if (status === 'pending') counts.pending += 1;
    if (status === 'processing') counts.processing += 1;
    if (['shipped', 'dispatched'].includes(status)) counts.shipped += 1;
    if (['delivered', 'completed'].includes(status)) counts.delivered += 1;
    if (['returned', 'return', 'return_requested', 'returned_to_seller', 'cancelled', 'canceled'].includes(status)) {
      counts.returnedCancelled += 1;
    }
  }
  counts.inProgress = counts.processing + counts.shipped;
  return counts;
}

function countFromAnalytics(
  pipeline: DropshippingOrderPipeline | undefined,
  stage: keyof DropshippingOrderPipeline,
  fallback: number | undefined
): number | undefined {
  return pipeline?.[stage] ?? fallback;
}

function buildRevenueTrend(
  transactions: readonly DropshippingAnalyticsTransaction[] | undefined,
  now: Date
): RevenuePoint[] {
  if (!transactions) return [];
  const earliest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const amountsByDate = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.status === 'lost') continue;
    const date = new Date(transaction.date);
    if (Number.isNaN(date.getTime()) || date < earliest || date > now) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    amountsByDate.set(key, (amountsByDate.get(key) ?? 0) + transaction.amount);
  }

  return Array.from(amountsByDate, ([key, amount]) => {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month, day);
    return {
      key,
      label: date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }),
      amount,
      timestamp: date.getTime(),
    };
  })
    .sort((left, right) => left.timestamp - right.timestamp)
    .map(({ key, label, amount }) => ({ key, label, amount }));
}

function monthlyProfit(
  transactions: readonly DropshippingAnalyticsTransaction[] | undefined,
  now: Date
): { thisMonth: number; lastMonth: number } | undefined {
  if (!transactions) return undefined;
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let current = 0;
  let previous = 0;

  for (const transaction of transactions) {
    if (transaction.type !== 'profit' || transaction.status === 'lost') continue;
    const date = new Date(transaction.date);
    if (Number.isNaN(date.getTime())) continue;
    if (date >= currentMonthStart && date < thisMonth) current += transaction.amount;
    else if (date >= lastMonthStart && date < currentMonthStart) previous += transaction.amount;
  }
  return { thisMonth: current, lastMonth: previous };
}

function buildTopProducts(orders: readonly DropshippingOrderSummary[]): TopProduct[] {
  const products = new Map<string, TopProduct>();
  for (const order of orders) {
    const raw = order as OrderRecord;
    const items = Array.isArray(raw.products) ? raw.products : [];
    for (const item of items) {
      const line = asRecord(item);
      const productValue = line.productId;
      const product = asRecord(productValue);
      const id = displayText(product._id ?? productValue);
      const name = displayText(line.name ?? product.productName ?? line.productName);
      const quantity = numericValue(line.quantity) || 1;
      const key = id || name;
      if (!key || !name) continue;
      const current = products.get(key);
      if (current) current.quantity += quantity;
      else products.set(key, { id: key, name, quantity });
    }
  }
  return Array.from(products.values())
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);
}

function orderId(order: DropshippingOrderSummary): string {
  const raw = order as OrderRecord;
  return displayText(raw.orderId ?? raw.orderNumber ?? raw._id ?? raw.id) || '—';
}

function orderDate(order: DropshippingOrderSummary): string {
  const raw = order as OrderRecord;
  const value = displayText(raw.createdAt ?? raw.created_at ?? raw.orderDate);
  if (!value) return 'তারিখ নেই';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'তারিখ নেই'
    : date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
}

function orderStatusLabel(order: DropshippingOrderSummary): string {
  const status = normalizedStatus(order as OrderRecord);
  const labels: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    dispatched: 'Shipped',
    delivered: 'Delivered',
    completed: 'Completed',
    returned: 'Returned',
    return: 'Returned',
    return_requested: 'Return requested',
    returned_to_seller: 'Returned',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
  };
  return labels[status] ?? (status || '—');
}

function orderStatusColor(order: DropshippingOrderSummary): string {
  const status = normalizedStatus(order as OrderRecord);
  if (['delivered', 'completed'].includes(status)) return '#087443';
  if (['returned', 'return', 'return_requested', 'returned_to_seller', 'cancelled', 'canceled'].includes(status)) {
    return '#B42318';
  }
  if (['shipped', 'dispatched'].includes(status)) return '#6941C6';
  return '#B54708';
}

function DashboardCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View className="mb-4 overflow-hidden rounded-[22px] border border-line bg-white">
      <View className="flex-row items-center px-4 pb-3 pt-4">
        <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
          <Ionicons name={icon} size={19} color={colors.primary} />
        </View>
        <Text className="flex-1 text-[14px] font-extrabold text-ink">{title}</Text>
        {action}
      </View>
      <View className="px-4 pb-4">{children}</View>
    </View>
  );
}

function SectionSkeleton({ height = 84 }: { height?: number }) {
  return (
    <View
      accessibilityLabel="তথ্য লোড হচ্ছে"
      className="items-center justify-center rounded-2xl bg-bg"
      style={{ minHeight: height }}
    >
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

function QueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="flex-row items-center rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
      <Ionicons name="alert-circle-outline" size={17} color="#B42318" />
      <Text className="ml-2 flex-1 text-[10px] leading-4 text-red-700">{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} className="ml-2 px-1 py-1">
        <Text className="text-[10px] font-bold text-primary">আবার চেষ্টা</Text>
      </Pressable>
    </View>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <View className="items-center justify-center rounded-xl bg-bg px-4 py-6">
      <Text className="text-center text-[11px] text-muted">{message}</Text>
    </View>
  );
}

function ProfitCard({
  transactions,
  isLoading,
  isError,
  onRetry,
}: {
  transactions: readonly DropshippingAnalyticsTransaction[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const profit = useMemo(() => monthlyProfit(transactions, new Date()), [transactions]);
  return (
    <DashboardCard title="Monthly Profit" icon="cash-outline">
      {isError ? (
        <QueryError message="লাভের তথ্য লোড করা যায়নি।" onRetry={onRetry} />
      ) : isLoading ? (
        <SectionSkeleton height={120} />
      ) : profit ? (
        <View className="flex-row">
          <View className="mr-2 flex-1 rounded-2xl border border-green-100 bg-tint-green p-3">
            <Text className="text-[9px] font-bold text-muted">THIS MONTH</Text>
            <Text numberOfLines={1} className="mt-1.5 text-[15px] font-extrabold text-green-800">
              {formatDropshippingTaka(profit.thisMonth)}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl border border-line bg-bg p-3">
            <Text className="text-[9px] font-bold text-muted">LAST MONTH</Text>
            <Text numberOfLines={1} className="mt-1.5 text-[15px] font-extrabold text-ink">
              {formatDropshippingTaka(profit.lastMonth)}
            </Text>
          </View>
        </View>
      ) : (
        <EmptySection message="লাভের লেনদেনের তথ্য পাওয়া যায়নি।" />
      )}
    </DashboardCard>
  );
}

function RevenueChart({
  points,
  isLoading,
  isError,
  hasTransactions,
  onRetry,
}: {
  points: readonly RevenuePoint[];
  isLoading: boolean;
  isError: boolean;
  hasTransactions: boolean;
  onRetry: () => void;
}) {
  const totalRevenue = points.reduce((total, point) => total + point.amount, 0);
  const maxAmount = Math.max(...points.map((point) => point.amount), 0);

  return (
    <DashboardCard
      title="Revenue Trend"
      icon="trending-up-outline"
      action={
        <View className="items-end">
          <Text className="text-[9px] text-muted">TOTAL</Text>
          <Text className="text-[12px] font-extrabold text-primary">
            {hasTransactions ? formatDropshippingTaka(totalRevenue) : '—'}
          </Text>
        </View>
      }
    >
      <Text className="-mt-2 mb-3 text-[10px] font-semibold text-muted">Last 30 days</Text>
      {isError ? (
        <QueryError message="রেভিনিউ ট্রেন্ড লোড করা যায়নি।" onRetry={onRetry} />
      ) : isLoading ? (
        <SectionSkeleton height={170} />
      ) : !hasTransactions || points.length === 0 ? (
        <EmptySection message="এখনো কোনো রেভিনিউ তথ্য নেই।" />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'flex-end', minHeight: 146 }}
          >
            {points.map((point) => (
              <View key={point.key} className="mx-1.5 items-center justify-end">
                <Text numberOfLines={1} className="mb-1 text-[8px] text-muted">
                  {formatDropshippingNumber(point.amount)}
                </Text>
                <View
                  className="w-4 rounded-t-md bg-primary"
                  style={{
                    height: maxAmount > 0
                      ? Math.max(8, (Math.max(point.amount, 0) / maxAmount) * 96)
                      : 8,
                    opacity: point.amount < 0 ? 0.55 : 1,
                  }}
                />
                <Text className="mt-1.5 text-[8px] text-muted">{point.label}</Text>
              </View>
            ))}
          </ScrollView>
          <View className="mt-2 h-px bg-line" />
          <View className="mt-2 flex-row items-center">
            <View className="mr-1.5 h-2 w-2 rounded-full bg-primary" />
            <Text className="text-[9px] text-muted">দৈনিক রেভিনিউ</Text>
          </View>
        </>
      )}
    </DashboardCard>
  );
}

function OrderPipelineCard({
  pipeline,
  fallbackCounts,
  isLoading,
  isError,
  onRetry,
}: {
  pipeline: DropshippingOrderPipeline | undefined;
  fallbackCounts: OrderCounts | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const stages = ORDER_STAGES.map((stage) => {
    const fallback = stage.key === 'pending'
      ? fallbackCounts?.pending
      : stage.key === 'processing'
        ? fallbackCounts?.processing
        : stage.key === 'shipped'
          ? fallbackCounts?.shipped
          : fallbackCounts?.delivered;
    return {
      ...stage,
      count: countFromAnalytics(pipeline, stage.key, fallback),
    };
  });
  const hasPipelineData = Boolean(pipeline) || Boolean(fallbackCounts);
  const total = stages.reduce((sum, stage) => sum + (stage.count ?? 0), 0);

  return (
    <DashboardCard
      title="Order Pipeline"
      icon="git-branch-outline"
      action={
        <Text className="text-[10px] font-bold text-muted">
          {hasPipelineData ? `${formatDropshippingNumber(total)} total` : '—'}
        </Text>
      }
    >
      {isError && !pipeline && !fallbackCounts ? (
        <QueryError message="অর্ডার পাইপলাইন লোড করা যায়নি।" onRetry={onRetry} />
      ) : isLoading && !hasPipelineData ? (
        <SectionSkeleton height={120} />
      ) : !hasPipelineData ? (
        <EmptySection message="অর্ডার পাইপলাইনের তথ্য পাওয়া যায়নি।" />
      ) : total === 0 ? (
        <EmptySection message="এখনো কোনো অর্ডার নেই।" />
      ) : (
        <View>
          {stages.map((stage) => {
            const count = stage.count ?? 0;
            const progress = total > 0 ? (count / total) * 100 : 0;
            return (
              <View key={stage.key} className="mb-3 flex-row items-center">
                <Text numberOfLines={1} className="w-[82px] text-[9px] font-bold text-muted">
                  {stage.label}
                </Text>
                <View className="mx-2 h-3 flex-1 overflow-hidden rounded-full bg-bg">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </View>
                <Text className="w-7 text-right text-[10px] font-extrabold text-ink">
                  {formatDropshippingNumber(count)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </DashboardCard>
  );
}

function OrderMetricCard({
  title,
  count,
  icon,
  color,
  tint,
  isLoading,
  onPress,
}: {
  title: string;
  count: number | undefined;
  icon: IconName;
  color: string;
  tint: string;
  isLoading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-2 mr-2 min-h-[106px] flex-1 rounded-2xl border border-line bg-white p-3"
    >
      <View className="h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: tint }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      {isLoading ? (
        <View className="mt-2 h-5 w-12 rounded bg-slate-100" />
      ) : (
        <Text className="mt-2 text-[16px] font-extrabold text-ink">
          {count === undefined ? '—' : formatDropshippingNumber(count)}
        </Text>
      )}
      <Text numberOfLines={2} className="mt-0.5 text-[9px] leading-4 text-muted">{title}</Text>
    </Pressable>
  );
}

function RecentOrdersCard({
  orders,
  isLoading,
  isError,
  onRetry,
  onViewAll,
  onOpenOrder,
}: {
  orders: readonly DropshippingOrderSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onViewAll: () => void;
  onOpenOrder: (order: DropshippingOrderSummary) => void;
}) {
  const recentOrders = useMemo(
    () => [...(orders ?? [])]
      .sort((left, right) => {
        const leftDate = new Date(displayText((left as OrderRecord).createdAt)).getTime();
        const rightDate = new Date(displayText((right as OrderRecord).createdAt)).getTime();
        return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
      })
      .slice(0, 5),
    [orders]
  );

  return (
    <DashboardCard
      title="Recent Orders"
      icon="cube-outline"
      action={
        <Pressable accessibilityRole="button" onPress={onViewAll} className="flex-row items-center py-1">
          <Text className="text-[10px] font-bold text-primary">View All</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primary} style={{ marginLeft: 3 }} />
        </Pressable>
      }
    >
      {isError && !orders ? (
        <QueryError message="সাম্প্রতিক অর্ডার লোড করা যায়নি।" onRetry={onRetry} />
      ) : isLoading && !orders ? (
        <SectionSkeleton height={160} />
      ) : !recentOrders.length ? (
        <EmptySection message="এখনো কোনো অর্ডার নেই।" />
      ) : (
        recentOrders.map((order) => {
          const raw = order as OrderRecord;
          const total = numericValue(raw.totalAmt ?? raw.totalAmount ?? raw.totalPrice);
          const products = Array.isArray(raw.products) ? raw.products : [];
          const statusColor = orderStatusColor(order);
          return (
            <Pressable
              key={displayText(raw._id ?? raw.id ?? raw.orderId)}
              accessibilityRole="button"
              onPress={() => onOpenOrder(order)}
              className="mb-2 flex-row items-center rounded-xl bg-bg px-3 py-2.5"
            >
              <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-white">
                <Ionicons name="receipt-outline" size={17} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[11px] font-bold text-ink">
                  {orderId(order)}
                </Text>
                <Text className="mt-0.5 text-[9px] text-muted">
                  {formatDropshippingNumber(products.length)}টি পণ্য · {orderDate(order)}
                </Text>
              </View>
              <View className="items-end">
                <Text numberOfLines={1} className="text-[10px] font-extrabold text-ink">
                  {total === undefined ? '—' : formatDropshippingTaka(total)}
                </Text>
                <Text numberOfLines={1} style={{ color: statusColor }} className="mt-0.5 text-[8px] font-bold">
                  {orderStatusLabel(order)}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </DashboardCard>
  );
}

function TopProductsCard({
  products,
  isLoading,
  isError,
  onRetry,
}: {
  products: readonly TopProduct[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const maxQuantity = Math.max(...(products ?? []).map((product) => product.quantity), 0);
  return (
    <DashboardCard title="Top Products" icon="bag-handle-outline">
      {isError && !products ? (
        <QueryError message="পণ্যের বিক্রির তথ্য লোড করা যায়নি।" onRetry={onRetry} />
      ) : isLoading && !products ? (
        <SectionSkeleton height={160} />
      ) : !products?.length ? (
        <EmptySection message="এখনো কোনো পণ্য বিক্রি হয়নি।" />
      ) : (
        products.map((product, index) => (
          <View key={product.id} className="mb-3 flex-row items-center">
            <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-primary-light">
              <Text className="text-[10px] font-extrabold text-primary">#{index + 1}</Text>
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="text-[11px] font-bold text-ink">
                {product.name}
              </Text>
              <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${maxQuantity > 0 ? (product.quantity / maxQuantity) * 100 : 0}%`,
                  }}
                />
              </View>
            </View>
            <Text className="ml-2 w-[50px] text-right text-[10px] font-bold text-muted">
              {formatDropshippingNumber(product.quantity)} sold
            </Text>
          </View>
        ))
      )}
    </DashboardCard>
  );
}

export function DropshippingSellerDashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const user = useAppSelector((state) => state.auth.user);
  const profileQuery = useDropshippingProfileQuery();
  const ordersQuery = useDropshippingOrdersQuery();
  const analyticsQuery = useDropshippingAnalyticsQuery();
  const profile = profileQuery.data;
  const orders = ordersQuery.data;
  const transactions = analyticsQuery.data?.transactions;
  const pipeline = analyticsQuery.data?.orderPipeline;
  const counts = useMemo(() => (orders ? countOrders(orders) : undefined), [orders]);
  const trend = useMemo(
    () => buildRevenueTrend(transactions, new Date()),
    [transactions]
  );
  const topProducts = useMemo(
    () => (orders ? buildTopProducts(orders) : undefined),
    [orders]
  );
  const isRefreshing =
    profileQuery.isRefetching || ordersQuery.isRefetching || analyticsQuery.isRefetching;
  const cardWidth = width >= 760 ? '48.5%' : '100%';

  const orderList = () =>
    router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'order-list' } });
  const analyticsPage = () =>
    router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'my-analytics' } });
  const paymentRequest = () =>
    router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'payment-request' } });
  const retryAll = () => {
    void Promise.all([
      profileQuery.refetch(),
      ordersQuery.refetch(),
      analyticsQuery.refetch(),
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={retryAll} tintColor={colors.primary} />
        }
      >
        <View className="mb-4 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
            onPress={() => router.replace('/(dropshipping)')}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          >
            <Ionicons name="arrow-back" size={19} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[17px] font-extrabold text-ink">
              {user?.name ? `স্বাগতম, ${user.name.split(' ')[0]}!` : 'Seller Dashboard'}
            </Text>
            <Text className="mt-0.5 text-[10px] text-muted">
              Track your sales, profits, and orders in real-time
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ড্যাশবোর্ড রিফ্রেশ"
            onPress={retryAll}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary-light"
          >
            {isRefreshing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="refresh-outline" size={19} color={colors.primary} />}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={paymentRequest}
          className="mb-4 overflow-hidden rounded-[24px] bg-primary p-5"
        >
          <View className="absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-white/10" />
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="mr-2.5 h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <Ionicons name="wallet-outline" size={21} color="#FFFFFF" />
              </View>
              <Text className="text-[11px] font-extrabold uppercase tracking-wide text-white/80">
                Available Balance
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
          </View>
          <Text className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-white/75">
            Your Balance
          </Text>
          {profileQuery.isPending ? (
            <View className="mt-2 h-9 w-36 items-start justify-center">
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : profileQuery.isError &&
            (profile?.balance === undefined || profile.balance === null) ? (
            <Pressable
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                void profileQuery.refetch();
              }}
              className="mt-2 self-start"
            >
              <Text className="text-[11px] font-bold text-white">
                ব্যালেন্স লোড হয়নি · আবার চেষ্টা করুন
              </Text>
            </Pressable>
          ) : (
            <Text className="mt-1 text-[27px] font-extrabold text-white">
              {profile?.balance === undefined || profile.balance === null
                ? '—'
                : formatDropshippingTaka(profile.balance)}
            </Text>
          )}
          <Text className="mt-1 text-[10px] font-semibold text-white/80">
            Ready to withdraw anytime · পেমেন্ট অনুরোধ
          </Text>
        </Pressable>

        {profileQuery.isError && profile?.balance !== undefined && profile.balance !== null ? (
          <View className="mb-3">
            <QueryError message="ব্যালেন্স আপডেট করা যায়নি।" onRetry={() => void profileQuery.refetch()} />
          </View>
        ) : null}
        {analyticsQuery.isError && analyticsQuery.data ? (
          <View className="mb-3">
            <QueryError
              message="অ্যানালিটিক্স আপডেট করা যায়নি; আগের তথ্য দেখানো হচ্ছে।"
              onRetry={() => void analyticsQuery.refetch()}
            />
          </View>
        ) : null}
        {ordersQuery.isError && orders ? (
          <View className="mb-3">
            <QueryError
              message="অর্ডার আপডেট করা যায়নি; আগের তথ্য দেখানো হচ্ছে।"
              onRetry={() => void ordersQuery.refetch()}
            />
          </View>
        ) : null}

        <View className="flex-row flex-wrap justify-between">
          <View style={{ width: cardWidth }}>
            <ProfitCard
              transactions={transactions}
              isLoading={analyticsQuery.isPending}
              isError={analyticsQuery.isError && !analyticsQuery.data}
              onRetry={() => void analyticsQuery.refetch()}
            />
          </View>
          <View style={{ width: cardWidth }}>
            <RevenueChart
              points={trend}
              isLoading={analyticsQuery.isPending}
              isError={analyticsQuery.isError && !analyticsQuery.data}
              hasTransactions={transactions !== undefined}
              onRetry={() => void analyticsQuery.refetch()}
            />
          </View>
          <View style={{ width: cardWidth }}>
            <OrderPipelineCard
              pipeline={pipeline}
              fallbackCounts={counts}
              isLoading={ordersQuery.isPending || analyticsQuery.isPending}
              isError={ordersQuery.isError || analyticsQuery.isError}
              onRetry={() => {
                void Promise.all([ordersQuery.refetch(), analyticsQuery.refetch()]);
              }}
            />
          </View>
        </View>

        <View className="mb-1 flex-row flex-wrap">
          {DASHBOARD_METRICS.map((metric) => (
            <View key={metric.key} className="w-1/2">
              <OrderMetricCard
                title={metric.title}
                count={counts?.[metric.key]}
                icon={metric.icon}
                color={metric.color}
                tint={metric.tint}
                isLoading={ordersQuery.isPending}
                onPress={orderList}
              />
            </View>
          ))}
        </View>
        {ordersQuery.isError && !orders ? (
          <View className="mb-4">
            <QueryError
              message="অর্ডারের তথ্য লোড করা যায়নি।"
              onRetry={() => void ordersQuery.refetch()}
            />
          </View>
        ) : null}

        <View className="flex-row flex-wrap justify-between">
          <View style={{ width: cardWidth }}>
            <RecentOrdersCard
              orders={orders}
              isLoading={ordersQuery.isPending}
              isError={ordersQuery.isError}
              onRetry={() => void ordersQuery.refetch()}
              onViewAll={orderList}
              onOpenOrder={(order) => {
                const id = displayText(order._id ?? order.id);
                if (id) router.push({ pathname: '/(dropshipping)/order/[id]', params: { id } });
              }}
            />
          </View>
          <View style={{ width: cardWidth }}>
            <TopProductsCard
              products={topProducts}
              isLoading={ordersQuery.isPending}
              isError={ordersQuery.isError}
              onRetry={() => void ordersQuery.refetch()}
            />
          </View>
        </View>

        <View className="flex-row flex-wrap justify-center">
          <Pressable
            accessibilityRole="button"
            onPress={analyticsPage}
            className="mb-2 mr-2 min-h-12 flex-1 flex-row items-center justify-center rounded-xl border-2 border-line bg-white px-4 py-3"
          >
            <Ionicons name="trending-up-outline" size={17} color={colors.primary} />
            <Text className="ml-2 text-[11px] font-bold text-ink">View Analytics</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={orderList}
            className="mb-2 min-h-12 flex-1 flex-row items-center justify-center rounded-xl bg-primary px-4 py-3"
          >
            <Ionicons name="receipt-outline" size={17} color="#FFFFFF" />
            <Text className="ml-2 text-[11px] font-bold text-white">Manage Orders</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default DropshippingSellerDashboardScreen;
