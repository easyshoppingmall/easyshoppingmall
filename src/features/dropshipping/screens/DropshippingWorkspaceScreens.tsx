import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '../../../store/hooks';
import { colors } from '../../../shared/theme/colors';
import { formatDropshippingNumber, formatDropshippingTaka } from '../api/homeApi';
import type { DropshippingWorkspaceRecord } from '../api/workspaceApi';
import {
  dropshippingHomeQueryKeys,
  useDropshippingAnalyticsQuery,
  useDropshippingOrdersQuery,
  useDropshippingPaymentRequestsQuery,
  useDropshippingProfileQuery,
} from '../api/queries';
import { createDropshippingPaymentRequest } from '../api/workspaceApi';

function text(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function number(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(value: unknown): string {
  const status = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  const labels: Record<string, string> = {
    pending: 'অপেক্ষমাণ',
    processing: 'প্রক্রিয়াধীন',
    approved: 'অনুমোদিত',
    paid: 'পরিশোধিত',
    completed: 'সম্পন্ন',
    rejected: 'প্রত্যাখ্যাত',
    cancelled: 'বাতিল',
    failed: 'ব্যর্থ',
  };
  return labels[status] ?? (text(value) || 'অবস্থা নেই');
}

function paymentRequestStatusStyle(value: unknown): { color: string; background: string } {
  const status = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (['approved', 'paid', 'completed', 'success'].includes(status)) {
    return { color: '#087443', background: '#EAF7EE' };
  }
  if (['rejected', 'cancelled', 'failed'].includes(status)) {
    return { color: '#B42318', background: '#FDECEF' };
  }
  if (['processing', 'in_progress'].includes(status)) {
    return { color: '#175CD3', background: '#E5F4FD' };
  }
  return { color: '#B54708', background: '#FFF1E0' };
}

const PAYMENT_METHODS = [
  { key: 'bkash', label: 'বিকাশ', icon: 'phone-portrait-outline' as const },
  { key: 'nagad', label: 'নগদ', icon: 'phone-portrait-outline' as const },
  { key: 'rocket', label: 'রকেট', icon: 'phone-portrait-outline' as const },
  { key: 'bank', label: 'ব্যাংক', icon: 'business-outline' as const },
] as const;

function maskedAccount(value: string): string {
  const normalized = value.replace(/\s/g, '');
  return normalized.length <= 4
    ? normalized
    : `${'•'.repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-4)}`;
}

const ANALYTICS_FIELDS: {
  keys: string[];
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  color: string;
  money?: boolean;
}[] = [
  { keys: ['totalOrders', 'total_orders', 'orderCount'], title: 'মোট অর্ডার', icon: 'receipt-outline', tint: 'bg-primary-light', color: colors.primary },
  { keys: ['pendingOrders', 'pending_orders'], title: 'পেন্ডিং অর্ডার', icon: 'time-outline', tint: 'bg-tint-orange', color: '#B54708' },
  { keys: ['processingOrders', 'processing_orders'], title: 'প্রসেসিং অর্ডার', icon: 'sync-outline', tint: 'bg-tint-purple', color: '#6941C6' },
  { keys: ['deliveredOrders', 'delivered_orders'], title: 'ডেলিভারি সম্পন্ন', icon: 'checkmark-circle-outline', tint: 'bg-tint-green', color: '#087443' },
  { keys: ['totalSales', 'total_sales', 'sales', 'revenue'], title: 'মোট বিক্রি', icon: 'trending-up-outline', tint: 'bg-tint-blue', color: colors.primary, money: true },
  { keys: ['totalProfit', 'total_profit', 'profit', 'estimatedProfit'], title: 'মোট লাভ', icon: 'cash-outline', tint: 'bg-tint-green', color: '#087443', money: true },
  { keys: ['totalCommission', 'total_commission', 'commission'], title: 'কমিশন', icon: 'gift-outline', tint: 'bg-tint-pink', color: '#C11574', money: true },
  { keys: ['balance', 'availableBalance', 'available_balance'], title: 'উপলভ্য ব্যালেন্স', icon: 'wallet-outline', tint: 'bg-tint-yellow', color: '#A15C07', money: true },
];

function metricValue(summary: DropshippingWorkspaceRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = number(summary[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const router = useRouter();
  return (
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
        <Text className="text-[17px] font-extrabold text-ink">{title}</Text>
        <Text className="mt-0.5 text-[10px] text-muted">{subtitle}</Text>
      </View>
    </View>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-row items-center rounded-2xl border border-red-100 bg-red-50 p-3">
      <Ionicons name="alert-circle-outline" size={19} color="#B42318" />
      <Text className="ml-2 flex-1 text-[10px] leading-4 text-red-700">{message}</Text>
      <Pressable onPress={onRetry} className="ml-2 rounded-lg bg-white px-3 py-2">
        <Text className="text-[9px] font-bold text-primary">আবার চেষ্টা</Text>
      </Pressable>
    </View>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <View className="items-center rounded-2xl border border-line bg-white py-9">
      <ActivityIndicator size="small" color={colors.primary} />
      <Text className="mt-2 text-[10px] text-muted">{label}</Text>
    </View>
  );
}

function MetricCard({
  title,
  value,
  icon,
  tint,
  iconColor,
  subtitle,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <View className="mb-2 mr-2 min-h-[110px] flex-1 rounded-2xl border border-line bg-white p-3">
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text numberOfLines={1} className="mt-2 text-[15px] font-extrabold text-ink">{value}</Text>
      <Text numberOfLines={1} className="mt-0.5 text-[9px] text-muted">{title}</Text>
      {subtitle ? <Text numberOfLines={1} className="mt-1 text-[8px] text-muted">{subtitle}</Text> : null}
    </View>
  );
}

function ActionCard({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-2 flex-row items-center rounded-2xl border border-line bg-white p-3"
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-[11px] font-bold text-ink">{title}</Text>
        <Text className="mt-1 text-[9px] leading-4 text-muted">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.muted} />
    </Pressable>
  );
}

export function DropshippingAnalyticsScreen() {
  const query = useDropshippingAnalyticsQuery();
  const summary = query.data ?? {};
  const metrics = ANALYTICS_FIELDS.flatMap((field) => {
    const value = metricValue(summary, field.keys);
    return value === undefined
      ? []
      : [{
          ...field,
          value: field.money
            ? formatDropshippingTaka(value)
            : formatDropshippingNumber(value),
        }];
  });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        contentContainerClassName="px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />
        }
      >
        <PageHeader title="আমার অ্যানালিটিক্স" subtitle="আপনার ড্রপশিপিং বিক্রি ও পারফরম্যান্স" />
        <View className="mb-4 rounded-2xl bg-primary p-4">
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Ionicons name="analytics-outline" size={21} color="#FFFFFF" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[13px] font-extrabold text-white">আপনার ব্যবসার চিত্র</Text>
              <Text className="mt-1 text-[9px] text-white/75">সার্ভারের সর্বশেষ হিসাব অনুযায়ী</Text>
            </View>
            <Pressable onPress={() => void query.refetch()} className="h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              {query.isRefetching
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>
        {query.isError ? (
          <ErrorCard
            message={query.error instanceof Error ? query.error.message : 'অ্যানালিটিক্স লোড করা যায়নি।'}
            onRetry={() => void query.refetch()}
          />
        ) : query.isPending ? (
          <LoadingState label="অ্যানালিটিক্স লোড হচ্ছে..." />
        ) : metrics.length ? (
          <>
            <View className="flex-row flex-wrap">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.title}
                  title={metric.title}
                  value={metric.value}
                  icon={metric.icon}
                  tint={metric.tint}
                  iconColor={metric.color}
                />
              ))}
            </View>
            {text(summary.updatedAt ?? summary.updated_at) ? (
              <Text className="mt-2 text-right text-[9px] text-muted">
                আপডেট: {dateLabel(summary.updatedAt ?? summary.updated_at)}
              </Text>
            ) : null}
          </>
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-line bg-white px-5 py-9">
            <Ionicons name="bar-chart-outline" size={28} color={colors.muted} />
            <Text className="mt-3 text-[12px] font-bold text-ink">অ্যানালিটিক্স পাওয়া যায়নি</Text>
            <Text className="mt-1 text-center text-[9px] leading-4 text-muted">
              আপনার অ্যাকাউন্টের জন্য সার্ভার এখনো কোনো পরিসংখ্যান পাঠায়নি।
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function DropshippingDashboardScreen() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const profileQuery = useDropshippingProfileQuery();
  const ordersQuery = useDropshippingOrdersQuery();
  const analyticsQuery = useDropshippingAnalyticsQuery();
  const profile = profileQuery.data ?? user;
  const orders = ordersQuery.data ?? [];
  const orderRecords = orders as DropshippingWorkspaceRecord[];
  const statusCount = (status: string) => orderRecords.filter((order) =>
    text(order.order_status ?? order.status).toLowerCase() === status
  ).length;
  const summary = analyticsQuery.data ?? {};
  const balance = number(profile?.balance ?? summary.balance ?? summary.availableBalance);
  const displayName = text(profile?.shopName ?? profile?.name ?? user?.name) || 'ড্রপশিপার';
  const avatar = text(profile?.shopLogo ?? profile?.image ?? user?.image);
  const isLoading = profileQuery.isPending || ordersQuery.isPending || analyticsQuery.isPending;
  const hasError = profileQuery.isError || ordersQuery.isError || analyticsQuery.isError;
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
        contentContainerClassName="px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={profileQuery.isRefetching || ordersQuery.isRefetching || analyticsQuery.isRefetching} onRefresh={retryAll} tintColor={colors.primary} />
        }
      >
        <PageHeader title="ড্রপশিপিং ড্যাশবোর্ড" subtitle="আপনার ব্যবসা পরিচালনা করুন" />
        <View className="mb-4 overflow-hidden rounded-[24px] bg-primary p-4">
          <View className="absolute -right-5 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <View className="flex-row items-center">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/15">
              {avatar ? (
                <Image source={{ uri: avatar }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="storefront-outline" size={25} color="#FFFFFF" />
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text numberOfLines={1} className="text-[14px] font-extrabold text-white">{displayName}</Text>
              <Text className="mt-1 text-[9px] text-white/75">ড্রপশিপিং পার্টনার</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="ড্যাশবোর্ড রিফ্রেশ"
              onPress={retryAll}
              className="h-9 w-9 items-center justify-center rounded-xl bg-white/15"
            >
              {(profileQuery.isRefetching || ordersQuery.isRefetching || analyticsQuery.isRefetching)
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />}
            </Pressable>
          </View>
          <View className="mt-4 flex-row items-center justify-between rounded-xl bg-white/15 px-3 py-2.5">
            <View>
              <Text className="text-[9px] text-white/75">বর্তমান ব্যালেন্স</Text>
              <Text className="mt-1 text-[16px] font-extrabold text-white">
                {balance === undefined ? '—' : formatDropshippingTaka(balance)}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'payment-request' } })}
              className="flex-row items-center rounded-lg bg-white px-3 py-2"
            >
              <Ionicons name="wallet-outline" size={14} color={colors.primary} />
              <Text className="ml-1 text-[9px] font-bold text-primary">পেমেন্ট অনুরোধ</Text>
            </Pressable>
          </View>
        </View>

        {hasError ? (
          <View className="mb-3">
            <ErrorCard
              message="কিছু ড্যাশবোর্ড তথ্য লোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।"
              onRetry={retryAll}
            />
          </View>
        ) : null}
        {isLoading ? <LoadingState label="ড্যাশবোর্ড লোড হচ্ছে..." /> : (
          <>
            <View className="mb-2 flex-row">
              <MetricCard title="মোট অর্ডার" value={formatDropshippingNumber(orders.length)} icon="receipt-outline" tint="bg-primary-light" iconColor={colors.primary} />
              <MetricCard title="পেন্ডিং" value={formatDropshippingNumber(statusCount('pending'))} icon="time-outline" tint="bg-tint-orange" iconColor="#B54708" />
            </View>
            <View className="mb-2 flex-row">
              <MetricCard title="প্রসেসিং" value={formatDropshippingNumber(statusCount('processing'))} icon="sync-outline" tint="bg-tint-purple" iconColor="#6941C6" />
              <MetricCard title="সম্পন্ন" value={formatDropshippingNumber(statusCount('delivered') + statusCount('completed'))} icon="checkmark-circle-outline" tint="bg-tint-green" iconColor="#087443" />
            </View>
            {Object.keys(summary).length ? (
              <View className="mb-4 rounded-2xl border border-line bg-white p-3.5">
                <Text className="mb-2 text-[11px] font-extrabold text-ink">সার্ভার অ্যানালিটিক্স</Text>
                {ANALYTICS_FIELDS.flatMap((field) => {
                  const value = metricValue(summary, field.keys);
                  return value === undefined ? [] : [{
                    title: field.title,
                    value: field.money ? formatDropshippingTaka(value) : formatDropshippingNumber(value),
                  }];
                }).slice(0, 4).map((metric) => (
                  <View key={metric.title} className="flex-row items-center justify-between border-t border-line py-2">
                    <Text className="text-[9px] text-muted">{metric.title}</Text>
                    <Text className="text-[10px] font-bold text-ink">{metric.value}</Text>
                  </View>
                ))}
                <Pressable onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'my-analytics' } })} className="mt-2 flex-row items-center justify-center rounded-lg bg-primary-light py-2">
                  <Text className="text-[9px] font-bold text-primary">সব অ্যানালিটিক্স দেখুন</Text>
                  <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                </Pressable>
              </View>
            ) : null}
          </>
        )}

        <Text className="mb-2 mt-2 text-[12px] font-extrabold text-ink">দ্রুত পরিচালনা</Text>
        <ActionCard
          title="অর্ডার তালিকা"
          description="অর্ডারের অবস্থা ও বিস্তারিত দেখুন"
          icon="receipt-outline"
          onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'order-list' } })}
        />
        <ActionCard
          title="আমার অ্যানালিটিক্স"
          description="বিক্রি, লাভ ও অর্ডার পারফরম্যান্স"
          icon="analytics-outline"
          onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'my-analytics' } })}
        />
        <ActionCard
          title="শপ সেটিংস"
          description="শপের তথ্য ও পেমেন্ট গ্রহণের মাধ্যম"
          icon="settings-outline"
          onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'shop-settings' } })}
        />
        <ActionCard
          title="রেফারেল প্রোফাইল"
          description="রেফারেল সদস্য ও কমিশনের তথ্য"
          icon="people-outline"
          onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'referral-profile' } })}
        />
        <ActionCard
          title="পেমেন্ট অনুরোধ"
          description="পেমেন্ট অনুরোধের অবস্থা ও ইতিহাস"
          icon="wallet-outline"
          onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'payment-request' } })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function paymentRequestStatus(request: DropshippingWorkspaceRecord): string {
  return statusLabel(request.status ?? request.request_status ?? request.payment_status);
}

function PaymentRequestCard({ request }: { request: DropshippingWorkspaceRecord }) {
  const id = text(request._id ?? request.id ?? request.requestId);
  const amountValue = number(request.amount ?? request.requestedAmount ?? request.paymentAmount);
  const methodValue = text(request.method ?? request.paymentMethod ?? request.payment_method ?? request.provider);
  const method = PAYMENT_METHODS.find((item) => item.key === methodValue.toLowerCase())?.label ?? methodValue;
  const account = text(request.accountNumber ?? request.account_number ?? request.account ?? request.number);
  const date = dateLabel(request.createdAt ?? request.created_at ?? request.requestedAt);
  const transactionId = text(request.transactionId ?? request.transaction_id ?? request.trxId);
  const receipt = text(request.receiptUrl ?? request.receipt_url ?? request.receipt);
  const note = text(request.adminNote ?? request.admin_note ?? request.rejectionReason ?? request.rejection_reason ?? request.note ?? request.message);
  const status = request.status ?? request.request_status ?? request.payment_status;
  const badge = paymentRequestStatusStyle(status);
  return (
    <View className="mb-2 rounded-2xl border border-line bg-white p-3.5">
      <View className="flex-row items-center">
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
          <Ionicons name="wallet-outline" size={18} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-[11px] font-bold text-ink">
            {amountValue === undefined ? 'পেমেন্ট অনুরোধ' : formatDropshippingTaka(amountValue)}
          </Text>
          {id ? <Text className="mt-1 text-[8px] text-muted">রেফারেন্স: {id}</Text> : null}
        </View>
        <View style={{ backgroundColor: badge.background }} className="rounded-full px-2.5 py-1">
          <Text style={{ color: badge.color }} className="text-[8px] font-bold">{paymentRequestStatus(request)}</Text>
        </View>
      </View>
      <View className="mt-3 border-t border-line pt-2.5">
        {method ? <DetailInfo label="পেমেন্ট মাধ্যম" value={method} /> : null}
        {account ? <DetailInfo label="অ্যাকাউন্ট" value={maskedAccount(account)} /> : null}
        {date ? <DetailInfo label="আবেদনের তারিখ" value={date} /> : null}
        {transactionId ? <DetailInfo label="ট্রানজেকশন আইডি" value={transactionId} /> : null}
        {note ? (
          <View className="mt-2 rounded-lg bg-bg px-3 py-2">
            <Text className="text-[8px] font-bold text-muted">অ্যাডমিন নোট</Text>
            <Text className="mt-1 text-[9px] leading-4 text-ink">{note}</Text>
          </View>
        ) : null}
        {receipt ? (
          <Pressable
            onPress={() => {
              void Linking.openURL(receipt).catch(() => {
                Alert.alert('রসিদ খোলা যায়নি', 'রসিদের লিংকটি এখন খোলা সম্ভব হচ্ছে না।');
              });
            }}
            className="mt-2 flex-row items-center self-start rounded-lg bg-primary-light px-3 py-2"
          >
            <Ionicons name="receipt-outline" size={14} color={colors.primary} />
            <Text className="ml-1.5 text-[9px] font-bold text-primary">রসিদ দেখুন</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function DetailInfo({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 flex-row justify-between">
      <Text className="text-[9px] text-muted">{label}</Text>
      <Text className="ml-3 flex-1 text-right text-[9px] font-semibold text-ink">{value}</Text>
    </View>
  );
}

export function DropshippingPaymentRequestScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAppSelector((state) => state.auth.user?._id);
  const profileQuery = useDropshippingProfileQuery();
  const requestQuery = useDropshippingPaymentRequestsQuery();
  const requests = requestQuery.data ?? [];
  const balance = number(profileQuery.data?.balance);
  const methods = useMemo(
    () => PAYMENT_METHODS.filter((method) => text(profileQuery.data?.paymentDetails?.[method.key])),
    [profileQuery.data?.paymentDetails]
  );
  const [selectedMethod, setSelectedMethod] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountNumberEdited, setAccountNumberEdited] = useState(false);
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState('');
  const activeMethod = methods.find((method) => method.key === selectedMethod) ?? methods[0];
  const savedAccount = activeMethod
    ? text(profileQuery.data?.paymentDetails?.[activeMethod.key])
    : '';
  const destinationAccount = accountNumberEdited ? accountNumber : savedAccount;
  const withdrawalMutation = useMutation({
    mutationFn: createDropshippingPaymentRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dropshippingHomeQueryKeys.paymentRequests(userId ?? ''),
        }),
        queryClient.invalidateQueries({
          queryKey: dropshippingHomeQueryKeys.profile(userId ?? ''),
        }),
      ]);
      setAmount('');
      setValidationError('');
    },
  });
  const refreshing = profileQuery.isRefetching || requestQuery.isRefetching;
  const refresh = () => {
    void Promise.all([profileQuery.refetch(), requestQuery.refetch()]);
  };
  const submitRequest = () => {
    setValidationError('');
    const parsedAmount = Number(amount.replace(/,/g, '').trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setValidationError('সঠিক উত্তোলনের পরিমাণ লিখুন।');
      return;
    }
    if (balance === undefined) {
      setValidationError('ব্যালেন্স যাচাই করা যাচ্ছে না। অনুগ্রহ করে আবার চেষ্টা করুন।');
      return;
    }
    if (parsedAmount > balance) {
      setValidationError('উত্তোলনের পরিমাণ আপনার উপলভ্য ব্যালেন্সের বেশি হতে পারবে না।');
      return;
    }
    if (!activeMethod) {
      setValidationError('প্রথমে প্রোফাইলে একটি পেমেন্ট গ্রহণের মাধ্যম যোগ করুন।');
      return;
    }
    if (!destinationAccount.trim()) {
      setValidationError('যে অ্যাকাউন্টে টাকা নিতে চান তার নম্বর লিখুন।');
      return;
    }
    withdrawalMutation.mutate({
      amount: parsedAmount,
      paymentMethod: activeMethod.key,
      accountNumber: destinationAccount.trim(),
    });
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        contentContainerClassName="px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <PageHeader title="পেমেন্ট অনুরোধ" subtitle="আপনার উত্তোলন অনুরোধ ও পেমেন্টের ইতিহাস" />
        {profileQuery.isError ? (
          <View className="mb-3">
            <ErrorCard
              message={profileQuery.error instanceof Error ? profileQuery.error.message : 'ব্যালেন্স লোড করা যায়নি।'}
              onRetry={() => void profileQuery.refetch()}
            />
          </View>
        ) : (
          <View className="mb-4 rounded-2xl bg-primary p-4">
            <Text className="text-[9px] text-white/75">বর্তমান ব্যালেন্স</Text>
            <Text className="mt-1 text-[21px] font-extrabold text-white">
              {balance === undefined ? '—' : formatDropshippingTaka(balance)}
            </Text>
            <Text className="mt-1 text-[9px] text-white/75">
              পেমেন্ট অনুরোধ জমার নিয়ম ও সীমা আপনার অ্যাকাউন্টের জন্য প্রযোজ্য।
            </Text>
          </View>
        )}
        <View className="mb-4 rounded-2xl border border-line bg-white p-4">
          <View className="mb-3 flex-row items-center">
            <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
              <Ionicons name="cash-outline" size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-[12px] font-extrabold text-ink">টাকা উত্তোলনের অনুরোধ</Text>
              <Text className="mt-0.5 text-[9px] text-muted">আপনার ড্রপশিপিং ব্যালেন্স থেকে অনুরোধ করুন</Text>
            </View>
          </View>
          {profileQuery.isPending ? (
            <LoadingState label="ব্যালেন্স ও পেমেন্ট মাধ্যম লোড হচ্ছে..." />
          ) : (
            <>
              <Text className="mb-2 text-[9px] font-bold text-ink">টাকা গ্রহণের মাধ্যম</Text>
              {methods.length ? (
                <View className="mb-3 flex-row flex-wrap">
                  {methods.map((method) => {
                    const isSelected = (activeMethod?.key ?? '') === method.key;
                    return (
                      <Pressable
                        key={method.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          setSelectedMethod(method.key);
                          setAccountNumber('');
                          setAccountNumberEdited(false);
                        }}
                        className={`mb-2 mr-2 flex-row items-center rounded-xl border px-3 py-2 ${
                          isSelected ? 'border-primary bg-primary-light' : 'border-line bg-white'
                        }`}
                      >
                        <Ionicons name={method.icon} size={15} color={isSelected ? colors.primary : colors.muted} />
                        <Text className={`ml-1.5 text-[9px] font-bold ${isSelected ? 'text-primary' : 'text-muted'}`}>
                          {method.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View className="mb-3 rounded-xl bg-tint-orange px-3 py-2.5">
                  <Text className="text-[9px] leading-4 text-[#8A4B08]">
                    আপনার প্রোফাইলে কোনো পেমেন্ট গ্রহণের মাধ্যম নেই। অনুরোধ করার আগে প্রোফাইল থেকে বিকাশ, নগদ, রকেট বা ব্যাংক তথ্য যোগ করুন।
                  </Text>
                  <Pressable
                    onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'shop-settings' } })}
                    className="mt-2 self-start rounded-lg bg-white px-3 py-2"
                  >
                    <Text className="text-[8px] font-bold text-primary">পেমেন্ট মাধ্যম সেট করুন</Text>
                  </Pressable>
                </View>
              )}
              <Text className="mb-1.5 text-[9px] font-bold text-ink">অ্যাকাউন্ট নম্বর</Text>
              <TextInput
                value={destinationAccount}
                onChangeText={(value) => {
                  setAccountNumber(value);
                  setAccountNumberEdited(true);
                }}
                editable={Boolean(activeMethod) && !withdrawalMutation.isPending}
                keyboardType="phone-pad"
                placeholder="টাকা গ্রহণের অ্যাকাউন্ট নম্বর"
                placeholderTextColor={colors.muted}
                className="mb-3 rounded-xl border border-line bg-bg px-3.5 py-3 text-[11px] text-ink"
              />
              <Text className="mb-1.5 text-[9px] font-bold text-ink">উত্তোলনের পরিমাণ</Text>
              <View className="mb-2 flex-row items-center rounded-xl border border-line bg-bg px-3.5">
                <Text className="mr-2 text-[12px] font-bold text-muted">৳</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  editable={balance !== undefined && Boolean(activeMethod) && !withdrawalMutation.isPending}
                  keyboardType="decimal-pad"
                  placeholder="যত টাকা তুলতে চান"
                  placeholderTextColor={colors.muted}
                  className="flex-1 py-3 text-[11px] text-ink"
                />
                <Pressable
                  onPress={() => setAmount(balance === undefined ? '' : String(balance))}
                  disabled={balance === undefined || !activeMethod || withdrawalMutation.isPending}
                  className="rounded-lg bg-primary-light px-2.5 py-1.5"
                >
                  <Text className="text-[8px] font-bold text-primary">সম্পূর্ণ</Text>
                </Pressable>
              </View>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-[9px] text-muted">উপলভ্য ব্যালেন্স</Text>
                <Text className="text-[9px] font-bold text-primary">
                  {balance === undefined ? '—' : formatDropshippingTaka(balance)}
                </Text>
              </View>
              {validationError ? (
                <Text accessibilityRole="alert" className="mb-2 text-[9px] leading-4 text-[#B42318]">
                  {validationError}
                </Text>
              ) : null}
              {withdrawalMutation.isError ? (
                <Text accessibilityRole="alert" className="mb-2 text-[9px] leading-4 text-[#B42318]">
                  {withdrawalMutation.error instanceof Error
                    ? withdrawalMutation.error.message
                    : 'অনুরোধ জমা দেওয়া যায়নি। আবার চেষ্টা করুন।'}
                </Text>
              ) : null}
              {withdrawalMutation.isSuccess ? (
                <View className="mb-3 rounded-xl bg-tint-green px-3 py-2.5">
                  <Text className="text-[9px] leading-4 text-[#087443]">
                    {text(withdrawalMutation.data.message) || 'অনুরোধ জমা হয়েছে। অনুমোদন বা পেমেন্টের অবস্থা সার্ভার নিশ্চিত করলে এখানে আপডেট হবে।'}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={submitRequest}
                disabled={!activeMethod || balance === undefined || withdrawalMutation.isPending}
                className={`min-h-11 flex-row items-center justify-center rounded-xl ${
                  !activeMethod || balance === undefined || withdrawalMutation.isPending
                    ? 'bg-primary/50'
                    : 'bg-primary'
                }`}
              >
                {withdrawalMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={15} color="#FFFFFF" />
                    <Text className="ml-2 text-[10px] font-extrabold text-white">অনুরোধ জমা দিন</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>
        <View className="mb-3 flex-row items-center">
          <Text className="flex-1 text-[12px] font-extrabold text-ink">অনুরোধের ইতিহাস</Text>
          <Pressable onPress={refresh} className="h-9 w-9 items-center justify-center rounded-xl bg-white">
            {refreshing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="refresh-outline" size={17} color={colors.primary} />}
          </Pressable>
        </View>
        {requestQuery.isError ? (
          <ErrorCard
            message={requestQuery.error instanceof Error ? requestQuery.error.message : 'অনুরোধের ইতিহাস লোড করা যায়নি।'}
            onRetry={() => void requestQuery.refetch()}
          />
        ) : requestQuery.isPending ? (
          <LoadingState label="পেমেন্ট অনুরোধ লোড হচ্ছে..." />
        ) : requests.length ? (
          requests.map((request, index) => (
            <PaymentRequestCard
              key={text(request._id ?? request.id ?? request.requestId) || `request-${index}`}
              request={request}
            />
          ))
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-line bg-white px-5 py-9">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-light">
              <Ionicons name="wallet-outline" size={23} color={colors.primary} />
            </View>
            <Text className="mt-3 text-[11px] font-bold text-ink">কোনো পেমেন্ট অনুরোধ নেই</Text>
            <Text className="mt-1 text-center text-[9px] leading-4 text-muted">
              নতুন অনুরোধ করলে তার অবস্থা এখানে দেখা যাবে।
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
