import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../../store/hooks';
import { colors } from '../../../shared/theme/colors';
import { formatDropshippingNumber, formatDropshippingTaka } from '../api/homeApi';
import type { DropshippingWorkspaceRecord } from '../api/workspaceApi';
import {
  useDropshippingAnalyticsQuery,
  useDropshippingOrdersQuery,
  useDropshippingPaymentRequestsQuery,
  useDropshippingProfileQuery,
} from '../api/queries';

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
  const method = text(request.method ?? request.paymentMethod ?? request.provider);
  const date = dateLabel(request.createdAt ?? request.created_at ?? request.requestedAt);
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
        <View className="rounded-full bg-primary-light px-2.5 py-1">
          <Text className="text-[8px] font-bold text-primary">{paymentRequestStatus(request)}</Text>
        </View>
      </View>
      {(method || date) ? (
        <View className="mt-3 flex-row justify-between border-t border-line pt-2.5">
          {method ? <Text className="text-[9px] text-muted">{method}</Text> : <View />}
          {date ? <Text className="text-[9px] text-muted">{date}</Text> : null}
        </View>
      ) : null}
      {text(request.note ?? request.message) ? (
        <Text className="mt-2 text-[9px] leading-4 text-muted">{text(request.note ?? request.message)}</Text>
      ) : null}
    </View>
  );
}

export function DropshippingPaymentRequestScreen() {
  const profileQuery = useDropshippingProfileQuery();
  const requestQuery = useDropshippingPaymentRequestsQuery();
  const requests = requestQuery.data ?? [];
  const balance = number(profileQuery.data?.balance);
  const refreshing = profileQuery.isRefetching || requestQuery.isRefetching;
  const refresh = () => {
    void Promise.all([profileQuery.refetch(), requestQuery.refetch()]);
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
