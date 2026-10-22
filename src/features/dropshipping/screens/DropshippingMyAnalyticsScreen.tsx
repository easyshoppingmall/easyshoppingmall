import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import type { ReferralOrder, ReferralUser } from '../../../api/authApi';
import { formatDropshippingNumber, formatDropshippingTaka } from '../api/homeApi';
import type {
  DropshippingAnalyticsTransaction,
  DropshippingOrderPipeline,
  DropshippingVideoReferral,
} from '../api/workspaceApi';
import {
  useDropshippingAnalyticsQuery,
  useDropshippingProfileDashboardQuery,
  useDropshippingProfileQuery,
} from '../api/queries';

type IconName = keyof typeof Ionicons.glyphMap;
type TimeRange = '7d' | '30d' | 'all' | 'custom';
type ReferralTab = 'partners' | 'video_buyers';

interface DateRange {
  startDate?: string;
  endDate?: string;
}

interface EarningPoint {
  key: string;
  label: string;
  amount: number;
}

interface OrderStatusPoint {
  label: string;
  count: number;
  color: string;
}

interface PartnerSummary {
  id: string;
  name: string;
  joinedAt?: string;
  orderCount: number;
  sales: number;
  income: number;
}

const DATE_RANGES: { id: TimeRange; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const STATUS_COLORS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444', '#0092EE'];

const SUMMARY_CARDS: {
  key: 'balance' | 'totalProfit' | 'pendingProfit' | 'referralIncome';
  title: string;
  caption: string;
  icon: IconName;
  color: string;
  tint: string;
}[] = [
  {
    key: 'balance',
    title: 'Available Balance',
    caption: 'Includes video & sales bonuses',
    icon: 'radio-button-on-outline',
    color: '#0F766E',
    tint: '#E8FAF7',
  },
  {
    key: 'totalProfit',
    title: 'Total Sales Profit',
    caption: 'Historical sales earnings',
    icon: 'cash-outline',
    color: '#087443',
    tint: '#EAF7EE',
  },
  {
    key: 'pendingProfit',
    title: 'Pending Revenue',
    caption: 'Awaiting approval/delivery',
    icon: 'time-outline',
    color: '#B54708',
    tint: '#FFF7E5',
  },
  {
    key: 'referralIncome',
    title: 'Referral Income',
    caption: 'Network & Video referrals',
    icon: 'trending-up-outline',
    color: '#175CD3',
    tint: '#EEF4FF',
  },
];

function displayText(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function amount(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function displayDate(value: string | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('bn-BD', options ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

function toApiDate(value: string, endOfDay = false): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date.toISOString();
}

function getQuickRange(range: Exclude<TimeRange, 'custom'>, now = new Date()): DateRange {
  if (range === 'all') return {};
  const start = new Date(now);
  start.setDate(start.getDate() - (range === '7d' ? 7 : 30));
  return { startDate: start.toISOString(), endDate: now.toISOString() };
}

function getTransactionDay(transaction: DropshippingAnalyticsTransaction): Date | undefined {
  const date = new Date(transaction.date);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildEarningsTrend(
  transactions: readonly DropshippingAnalyticsTransaction[] | undefined,
  videoReferrals: readonly DropshippingVideoReferral[] | undefined
): EarningPoint[] {
  if (!transactions && !videoReferrals) return [];
  const grouped = new Map<string, { date: Date; amount: number }>();
  const addAmount = (value: string, earned: number) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const current = grouped.get(key);
    if (current) current.amount += earned;
    else grouped.set(key, { date, amount: earned });
  };

  for (const transaction of transactions ?? []) {
    const date = getTransactionDay(transaction);
    if (!date) continue;
    addAmount(transaction.date, transaction.amount);
  }
  for (const referral of videoReferrals ?? []) {
    if (referral.status !== 'approved') continue;
    addAmount(referral.createdAt, referral.bonusAmount);
  }

  return Array.from(grouped, ([key, entry]) => ({
    key,
    label: entry.date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }),
    amount: entry.amount,
    timestamp: entry.date.getTime(),
  }))
    .sort((left, right) => left.timestamp - right.timestamp)
    .map(({ key, label, amount: earned }) => ({ key, label, amount: earned }));
}

function buildStatusMix(pipeline: DropshippingOrderPipeline | undefined): OrderStatusPoint[] {
  if (!pipeline) return [];
  return Object.entries(pipeline)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .map(([status, count], index) => ({
      label: status.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      count: count ?? 0,
      color: STATUS_COLORS[index % STATUS_COLORS.length],
    }));
}

function referralUserId(value: ReferralOrder['userId']): string {
  return typeof value === 'string' ? value : displayText(value?._id);
}

function buildPartnerSummaries(
  users: readonly ReferralUser[],
  orders: readonly ReferralOrder[]
): PartnerSummary[] {
  return users.map((user) => {
    const userOrders = orders.filter((order) => referralUserId(order.userId) === user._id);
    return {
      id: user._id,
      name: user.name?.trim() || user.email?.trim() || 'রেফারেল সদস্য',
      joinedAt: user.createdAt,
      orderCount: userOrders.length,
      sales: userOrders.reduce((total, order) => total + (amount(order.totalAmt) ?? 0), 0),
      income: userOrders.reduce(
        (total, order) => total + (amount(order.referralBonusAmount) ?? 0),
        0
      ),
    };
  });
}

function BackHeader({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  const router = useRouter();
  return (
    <View className="mb-5 flex-row items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
        onPress={() => router.replace('/(dropshipping)')}
        className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
      >
        <Ionicons name="arrow-back" size={19} color={colors.ink} />
      </Pressable>
      <View className="flex-1">
        <View className="mb-0.5 flex-row items-center">
          <Ionicons name="pulse-outline" size={14} color={colors.primary} />
          <Text className="ml-1.5 text-[9px] font-extrabold uppercase tracking-[1px] text-primary">
            Business Intelligence
          </Text>
        </View>
        <Text className="text-[19px] font-extrabold text-ink">Performance Analytics</Text>
        <Text className="mt-0.5 text-[10px] leading-4 text-muted">
          Track your profit margins and network growth in real-time.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="অ্যানালিটিক্স রিফ্রেশ"
        onPress={onRefresh}
        className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-primary-light"
      >
        {refreshing
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Ionicons name="refresh-outline" size={19} color={colors.primary} />}
      </Pressable>
    </View>
  );
}

function DateFilter({
  selected,
  onSelect,
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  onApply,
  error,
  isApplying,
}: {
  selected: TimeRange;
  onSelect: (range: TimeRange) => void;
  startDate: string;
  endDate: string;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
  onApply: () => void;
  error?: string;
  isApplying: boolean;
}) {
  return (
    <View className="mb-5 rounded-2xl border border-line bg-white p-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {DATE_RANGES.map((range) => {
          const active = range.id === selected;
          return (
            <Pressable
              key={range.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(range.id)}
              className={`mr-1 min-h-10 items-center justify-center rounded-xl px-3 ${
                active ? 'bg-primary' : 'bg-white'
              }`}
            >
              <Text className={`text-[10px] font-extrabold ${active ? 'text-white' : 'text-muted'}`}>
                {range.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {selected === 'custom' ? (
        <View className="mt-2 border-t border-line pt-3">
          <View className="flex-row items-center">
            <TextInput
              accessibilityLabel="শুরুর তারিখ"
              value={startDate}
              onChangeText={onChangeStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              className="h-10 flex-1 rounded-xl border border-line bg-bg px-2.5 text-center text-[11px] font-semibold text-ink"
            />
            <Text className="mx-2 text-[10px] font-bold text-muted">to</Text>
            <TextInput
              accessibilityLabel="শেষের তারিখ"
              value={endDate}
              onChangeText={onChangeEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              className="h-10 flex-1 rounded-xl border border-line bg-bg px-2.5 text-center text-[11px] font-semibold text-ink"
            />
          </View>
          {error ? <Text className="mt-2 text-[10px] leading-4 text-red-600">{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={onApply}
            disabled={isApplying}
            className={`mt-2 min-h-10 flex-row items-center justify-center rounded-xl px-3 ${
              isApplying ? 'bg-slate-300' : 'bg-primary'
            }`}
          >
            {isApplying ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text className="ml-1.5 text-[10px] font-bold text-white">
              {isApplying ? 'লোড হচ্ছে…' : 'Apply date range'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SummaryCard({
  title,
  caption,
  icon,
  color,
  tint,
  value,
  loading,
  error,
  onRetry,
}: {
  title: string;
  caption: string;
  icon: IconName;
  color: string;
  tint: string;
  value?: number;
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View
      className="mb-3 min-h-[146px] rounded-[22px] border p-3.5"
      style={{ borderColor: `${color}30`, backgroundColor: tint }}
    >
      <View className="flex-row items-start justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white">
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text className="ml-2 flex-1 text-right text-[8px] font-extrabold uppercase leading-3 text-muted">
          {caption}
        </Text>
      </View>
      <Text numberOfLines={2} className="mt-3 text-[9px] font-bold uppercase tracking-wide text-muted">
        {title}
      </Text>
      {loading ? (
        <View className="mt-2 h-5 w-24 rounded bg-white/80" />
      ) : error ? (
        <Pressable accessibilityRole="button" onPress={onRetry} className="mt-2 self-start">
          <Text className="text-[10px] font-semibold text-red-600">লোড হয়নি · আবার চেষ্টা</Text>
        </Pressable>
      ) : value === undefined ? (
        <Text className="mt-1.5 text-[11px] text-muted">তথ্য পাওয়া যায়নি</Text>
      ) : (
        <Text numberOfLines={1} className="mt-1 text-[18px] font-extrabold" style={{ color }}>
          {formatDropshippingTaka(value)}
        </Text>
      )}
    </View>
  );
}

function SectionCard({
  title,
  icon,
  children,
  trailing,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <View className="mb-4 overflow-hidden rounded-[24px] border border-line bg-white">
      <View className="flex-row items-center px-4 pb-3 pt-4">
        <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <Text className="flex-1 text-[13px] font-extrabold uppercase tracking-wide text-ink">
          {title}
        </Text>
        {trailing}
      </View>
      <View className="px-4 pb-4">{children}</View>
    </View>
  );
}

function QueryError({ onRetry, message }: { onRetry: () => void; message: string }) {
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

function SectionSkeleton({ height = 120 }: { height?: number }) {
  return (
    <View className="items-center justify-center rounded-2xl bg-bg" style={{ minHeight: height }}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text className="mt-2 text-[9px] text-muted">তথ্য লোড হচ্ছে…</Text>
    </View>
  );
}

function SummaryCards({
  totals,
  balance,
  analyticsLoading,
  analyticsError,
  profileLoading,
  profileError,
  onRetryAnalytics,
  onRetryProfile,
}: {
  totals?: Record<string, unknown>;
  balance?: number | null;
  analyticsLoading: boolean;
  analyticsError: boolean;
  profileLoading: boolean;
  profileError: boolean;
  onRetryAnalytics: () => void;
  onRetryProfile: () => void;
}) {
  const values: Record<(typeof SUMMARY_CARDS)[number]['key'], number | undefined> = {
    balance: amount(totals?.currentBalance) ?? amount(balance),
    totalProfit: amount(totals?.totalProfit),
    pendingProfit: amount(totals?.pendingProfit),
    referralIncome: amount(totals?.referralIncome),
  };

  return (
    <View className="flex-row flex-wrap justify-between">
      {SUMMARY_CARDS.map((card) => {
        const isBalance = card.key === 'balance';
        const loading = isBalance ? profileLoading && values.balance === undefined : analyticsLoading;
        const error = isBalance ? profileError : analyticsError;
        return (
          <View key={card.key} className="w-[48.5%]">
            <SummaryCard
              title={card.title}
              caption={card.caption}
              icon={card.icon}
              color={card.color}
              tint={card.tint}
              value={values[card.key]}
              loading={loading}
              error={error}
              onRetry={isBalance ? onRetryProfile : onRetryAnalytics}
            />
          </View>
        );
      })}
    </View>
  );
}

function EarningsTrend({
  points,
  loading,
  error,
  hasData,
  onRetry,
}: {
  points: readonly EarningPoint[];
  loading: boolean;
  error: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  const maxAmount = Math.max(...points.map((point) => point.amount), 0);
  return (
    <SectionCard
      title="Earnings Trend"
      icon="radio-button-on-outline"
      trailing={
        <View className="flex-row items-center">
          <View className="mr-1.5 h-2 w-2 rounded-full bg-primary" />
          <Text className="text-[8px] font-bold text-muted">Sales + Referral Profit</Text>
        </View>
      }
    >
      {error && !hasData ? (
        <QueryError message="আয়ের ট্রেন্ড লোড করা যায়নি।" onRetry={onRetry} />
      ) : loading && !hasData ? (
        <SectionSkeleton height={210} />
      ) : points.length === 0 ? (
        <View className="items-center justify-center rounded-xl bg-bg px-4 py-8">
          <Ionicons name="bar-chart-outline" size={23} color={colors.muted} />
          <Text className="mt-2 text-center text-[10px] text-muted">
            আয়ের কোনো তথ্য নেই; ডেটা এলে এখানে ট্রেন্ড দেখা যাবে।
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ minHeight: 190, alignItems: 'flex-end', paddingHorizontal: 4 }}
        >
          {points.map((point) => (
            <View key={point.key} className="mx-2 w-9 items-center justify-end">
              <Text numberOfLines={1} className="mb-1 text-[7px] text-muted">
                {formatDropshippingNumber(point.amount)}
              </Text>
              <View
                className="w-5 rounded-t-md bg-primary"
                style={{
                  height: maxAmount > 0
                    ? Math.max(7, (Math.max(0, point.amount) / maxAmount) * 116)
                    : 7,
                }}
              />
              <Text numberOfLines={1} className="mt-1.5 text-[7px] text-muted">{point.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SectionCard>
  );
}

function StatusMix({
  statuses,
  loading,
  error,
  hasData,
  onRetry,
}: {
  statuses: readonly OrderStatusPoint[];
  loading: boolean;
  error: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  const total = statuses.reduce((sum, status) => sum + status.count, 0);
  return (
    <SectionCard title="Status Mix" icon="pie-chart-outline">
      {error && !hasData ? (
        <QueryError message="অর্ডারের অবস্থা লোড করা যায়নি।" onRetry={onRetry} />
      ) : loading && !hasData ? (
        <SectionSkeleton height={150} />
      ) : statuses.length === 0 ? (
        <View className="items-center rounded-xl bg-bg px-4 py-7">
          <Text className="text-center text-[10px] text-muted">
            অর্ডারের status data পাওয়া যায়নি।
          </Text>
        </View>
      ) : (
        <>
          <View className="mb-4 h-4 flex-row overflow-hidden rounded-full bg-bg">
            {statuses.map((status) => (
              <View
                key={status.label}
                style={{
                  flex: status.count,
                  backgroundColor: status.color,
                  minWidth: status.count > 0 ? 3 : 0,
                }}
              />
            ))}
          </View>
          {statuses.map((status) => (
            <View key={status.label} className="mb-2 flex-row items-center">
              <View className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
              <Text className="flex-1 text-[10px] font-semibold text-muted">{status.label}</Text>
              <Text className="text-[10px] font-extrabold text-ink">
                {formatDropshippingNumber(status.count)}
              </Text>
              <Text className="ml-2 w-10 text-right text-[9px] text-muted">
                {total > 0 ? `${Math.round((status.count / total) * 100)}%` : '—'}
              </Text>
            </View>
          ))}
        </>
      )}
    </SectionCard>
  );
}

function ActivityList({
  transactions,
  loading,
  error,
  hasData,
  onRetry,
}: {
  transactions: readonly DropshippingAnalyticsTransaction[] | undefined;
  loading: boolean;
  error: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  const records = useMemo(
    () => [...(transactions ?? [])]
      .sort((left, right) => {
        const leftDate = getTransactionDay(left)?.getTime() ?? 0;
        const rightDate = getTransactionDay(right)?.getTime() ?? 0;
        return rightDate - leftDate;
      })
      .slice(0, 100),
    [transactions]
  );
  return (
    <SectionCard
      title="Recent Activity"
      icon="sync-outline"
      trailing={
        <View className="rounded-full bg-bg px-2.5 py-1">
          <Text className="text-[8px] font-extrabold uppercase text-muted">Last 100 Records</Text>
        </View>
      }
    >
      {error && !hasData ? (
        <QueryError message="সাম্প্রতিক কার্যক্রম লোড করা যায়নি।" onRetry={onRetry} />
      ) : loading && !hasData ? (
        <SectionSkeleton height={180} />
      ) : records.length === 0 ? (
        <View className="items-center rounded-xl bg-bg px-4 py-8">
          <Ionicons name="pulse-outline" size={22} color={colors.muted} />
          <Text className="mt-2 text-center text-[10px] text-muted">
            সাম্প্রতিক কোনো লেনদেন রেকর্ড নেই।
          </Text>
        </View>
      ) : (
        <View>
          {records.map((record, index) => {
            const isProfit = record.type === 'profit';
            const positive = record.status === 'credited';
            const lost = record.status === 'lost';
            const color = positive ? '#087443' : lost ? '#B42318' : '#B54708';
            const order = record.orderId ? `#${record.orderId.slice(-6).toUpperCase()}` : undefined;
            return (
              <View
                key={`${record.date}-${record.orderId ?? record.user ?? record.type}-${index}`}
                className="mb-2 flex-row items-center rounded-xl border border-line/70 px-3 py-2.5"
              >
                <View
                  className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: isProfit ? colors.tintGreen : colors.primaryLight }}
                >
                  <Ionicons
                    name={isProfit ? 'cash-outline' : 'people-outline'}
                    size={17}
                    color={isProfit ? '#087443' : colors.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-[10px] font-extrabold text-ink">
                    {isProfit ? 'Order Profit' : `Referral Bonus${record.user ? `: ${record.user}` : ''}`}
                  </Text>
                  <Text numberOfLines={1} className="mt-0.5 text-[8px] text-muted">
                    {[order, displayDate(record.date)].filter(Boolean).join(' · ') || 'তারিখ পাওয়া যায়নি'}
                  </Text>
                </View>
                <View className="ml-2 items-end">
                  <Text className="text-[10px] font-extrabold" style={{ color }}>
                    {positive ? '+' : ''}{formatDropshippingTaka(record.amount)}
                  </Text>
                  <Text className="mt-0.5 text-[8px] font-bold uppercase" style={{ color }}>
                    {record.status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </SectionCard>
  );
}

function PartnerNetwork({
  users,
  orders,
  loading,
  error,
  hasData,
  onRetry,
}: {
  users: readonly ReferralUser[];
  orders: readonly ReferralOrder[];
  loading: boolean;
  error: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  const partners = useMemo(() => buildPartnerSummaries(users, orders), [users, orders]);
  return (
    <>
      {error && !hasData ? (
        <QueryError message="রেফারেল নেটওয়ার্ক লোড করা যায়নি।" onRetry={onRetry} />
      ) : loading && !hasData ? (
        <SectionSkeleton height={160} />
      ) : partners.length === 0 ? (
        <View className="items-center rounded-xl bg-bg px-4 py-8">
          <Text className="text-center text-[10px] text-muted">কোনো referral partner data নেই।</Text>
        </View>
      ) : (
        partners.map((partner) => (
          <View key={partner.id} className="mb-2 rounded-xl border border-line/70 bg-white p-3">
            <View className="flex-row items-center">
              <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
                <Text className="text-[12px] font-extrabold text-primary">
                  {partner.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[11px] font-extrabold text-ink">
                  {partner.name}
                </Text>
                <Text className="mt-0.5 text-[8px] text-muted">
                  {displayDate(partner.joinedAt) || 'যোগদানের তারিখ নেই'}
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row border-t border-line pt-2.5">
              <View className="flex-1">
                <Text className="text-[8px] text-muted">Sales</Text>
                <Text className="mt-0.5 text-[9px] font-bold text-ink">
                  {formatDropshippingNumber(partner.orderCount)} orders
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-[8px] text-muted">Sales amount</Text>
                <Text className="mt-0.5 text-[9px] font-bold text-ink">
                  {formatDropshippingTaka(partner.sales)}
                </Text>
              </View>
              <View className="flex-1 items-end">
                <Text className="text-[8px] text-muted">Income</Text>
                <Text className="mt-0.5 text-[9px] font-bold text-primary">
                  {formatDropshippingTaka(partner.income)}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </>
  );
}

function VideoBuyerList({
  referrals,
  loading,
  error,
  hasData,
  onRetry,
}: {
  referrals: readonly DropshippingVideoReferral[] | undefined;
  loading: boolean;
  error: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  if (error && !hasData) {
    return <QueryError message="ভিডিও রেফারেল লোড করা যায়নি।" onRetry={onRetry} />;
  }
  if (loading && !hasData) return <SectionSkeleton height={160} />;
  if (!referrals?.length) {
    return (
      <View className="items-center rounded-xl bg-bg px-4 py-8">
        <Text className="text-center text-[10px] text-muted">কোনো video referral data নেই।</Text>
      </View>
    );
  }
  return (
    <>
      {referrals.map((referral, index) => {
        const color = referral.status === 'approved'
          ? '#087443'
          : referral.status === 'pending'
            ? '#B54708'
            : '#B42318';
        return (
          <View key={`${referral.buyerEmail}-${referral.createdAt}-${index}`} className="mb-2 rounded-xl border border-line/70 p-3">
            <View className="flex-row items-start">
              <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-tint-purple">
                <Ionicons name="person-outline" size={17} color="#6941C6" />
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[10px] font-extrabold text-ink">
                  {referral.buyerName}
                </Text>
                <Text numberOfLines={1} className="mt-0.5 text-[8px] text-muted">
                  {referral.buyerEmail}
                </Text>
              </View>
              <Text className="ml-2 text-[8px] font-extrabold uppercase" style={{ color }}>
                {referral.status}
              </Text>
            </View>
            <Text numberOfLines={2} className="mt-2 text-[9px] font-semibold leading-4 text-ink">
              {referral.courseTitle}
            </Text>
            <Text className="mt-0.5 text-[8px] text-muted">{displayDate(referral.createdAt)}</Text>
            <View className="mt-2 flex-row border-t border-line pt-2">
              <Text className="flex-1 text-[9px] text-muted">
                Paid {formatDropshippingTaka(referral.amount)}
              </Text>
              <Text className="text-[9px] font-bold text-primary">
                Bonus {formatDropshippingTaka(referral.bonusAmount)}
              </Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

function ReferralNetwork({
  tab,
  onSelectTab,
  users,
  orders,
  videoReferrals,
  profileLoading,
  profileError,
  profileHasData,
  analyticsLoading,
  analyticsError,
  analyticsHasData,
  onRetryProfile,
  onRetryAnalytics,
}: {
  tab: ReferralTab;
  onSelectTab: (tab: ReferralTab) => void;
  users: readonly ReferralUser[];
  orders: readonly ReferralOrder[];
  videoReferrals: readonly DropshippingVideoReferral[] | undefined;
  profileLoading: boolean;
  profileError: boolean;
  profileHasData: boolean;
  analyticsLoading: boolean;
  analyticsError: boolean;
  analyticsHasData: boolean;
  onRetryProfile: () => void;
  onRetryAnalytics: () => void;
}) {
  return (
    <SectionCard
      title="Referral Network"
      icon="people-outline"
      trailing={
        <View className="flex-row rounded-xl bg-bg p-1">
          {([
            { id: 'partners', label: `Partners (${users.length})` },
            { id: 'video_buyers', label: `Video Buyers (${videoReferrals?.length ?? 0})` },
          ] as const).map((item) => {
            const selected = tab === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectTab(item.id)}
                className={`rounded-lg px-2 py-2 ${selected ? 'bg-white' : ''}`}
              >
                <Text className={`text-[8px] font-extrabold ${selected ? 'text-primary' : 'text-muted'}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      }
    >
      {tab === 'partners' ? (
        <PartnerNetwork
          users={users}
          orders={orders}
          loading={profileLoading}
          error={profileError}
          hasData={profileHasData}
          onRetry={onRetryProfile}
        />
      ) : (
        <VideoBuyerList
          referrals={videoReferrals}
          loading={analyticsLoading}
          error={analyticsError}
          hasData={analyticsHasData}
          onRetry={onRetryAnalytics}
        />
      )}
    </SectionCard>
  );
}

export function DropshippingMyAnalyticsScreen() {
  const router = useRouter();
  const profileQuery = useDropshippingProfileQuery();
  const profileDashboardQuery = useDropshippingProfileDashboardQuery();
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedRange, setAppliedRange] = useState<{
    filter: TimeRange;
    dates: DateRange;
  }>({ filter: 'all', dates: {} });
  const [dateError, setDateError] = useState('');
  const [referralTab, setReferralTab] = useState<ReferralTab>('partners');
  const analyticsQuery = useDropshippingAnalyticsQuery(appliedRange.dates);
  const analytics = analyticsQuery.data;
  const analyticsTotals = analytics?.summary;
  const transactions = analytics?.transactions;
  const videoReferrals = analytics?.videoReferrals;
  const pipeline = analytics?.orderPipeline;
  const statuses = useMemo(() => buildStatusMix(pipeline), [pipeline]);
  const earningsTrend = useMemo(
    () => buildEarningsTrend(transactions, videoReferrals),
    [transactions, videoReferrals]
  );
  const profileDashboard = profileDashboardQuery.data;
  const users = profileDashboard?.referrals.users ?? [];
  const referralOrders = profileDashboard?.referrals.orders ?? [];
  const refreshing =
    analyticsQuery.isRefetching || profileQuery.isRefetching || profileDashboardQuery.isRefetching;
  const anyData = Boolean(
    analyticsTotals ||
    transactions?.length ||
    videoReferrals?.length ||
    pipeline ||
    profileQuery.data ||
    profileDashboard
  );

  const selectRange = (range: TimeRange) => {
    setTimeRange(range);
    setDateError('');
    if (range === 'custom') return;
    setAppliedRange({ filter: range, dates: getQuickRange(range) });
  };

  const applyCustomRange = () => {
    const startDate = toApiDate(customStart);
    const endDate = toApiDate(customEnd, true);
    if (!startDate || !endDate) {
      setDateError('শুরু ও শেষের তারিখ YYYY-MM-DD ফরম্যাটে লিখুন।');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setDateError('শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না।');
      return;
    }
    setDateError('');
    setAppliedRange({ filter: 'custom', dates: { startDate, endDate } });
  };

  const refreshAll = () => {
    void Promise.all([
      analyticsQuery.refetch(),
      profileQuery.refetch(),
      profileDashboardQuery.refetch(),
    ]);
  };
  const analyticsRetry = () => void analyticsQuery.refetch();
  const profileRetry = () => {
    void Promise.all([profileQuery.refetch(), profileDashboardQuery.refetch()]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />
        }
      >
        <BackHeader refreshing={refreshing} onRefresh={refreshAll} />

        <View className="mb-3 flex-row items-center">
          <Text className="flex-1 text-[11px] leading-4 text-muted">
            আপনার নির্দিষ্ট সময়ের ড্রপশিপিং পারফরম্যান্স দেখুন।
          </Text>
          {analyticsQuery.isFetching ? (
            <View className="ml-2 flex-row items-center">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="ml-1 text-[8px] font-semibold text-primary">আপডেট হচ্ছে</Text>
            </View>
          ) : null}
        </View>

        <DateFilter
          selected={timeRange}
          onSelect={selectRange}
          startDate={customStart}
          endDate={customEnd}
          onChangeStart={(value) => {
            setCustomStart(value);
            setDateError('');
          }}
          onChangeEnd={(value) => {
            setCustomEnd(value);
            setDateError('');
          }}
          onApply={applyCustomRange}
          error={dateError}
          isApplying={timeRange === 'custom' && analyticsQuery.isFetching}
        />

        {!anyData && analyticsQuery.isError && profileQuery.isError ? (
          <QueryError
            message="অ্যানালিটিক্স লোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।"
            onRetry={refreshAll}
          />
        ) : null}

        <SummaryCards
          totals={analyticsTotals}
          balance={profileQuery.data?.balance}
          analyticsLoading={analyticsQuery.isPending}
          analyticsError={analyticsQuery.isError && !analytics}
          profileLoading={profileQuery.isPending}
          profileError={profileQuery.isError && !profileQuery.data}
          onRetryAnalytics={analyticsRetry}
          onRetryProfile={profileRetry}
        />

        {analyticsQuery.isError && analytics ? (
          <View className="mb-3">
            <QueryError
              message="নতুন সময়সীমার তথ্য পাওয়া যায়নি; আগের ক্যাশ করা তথ্য দেখানো হচ্ছে।"
              onRetry={analyticsRetry}
            />
          </View>
        ) : null}

        <EarningsTrend
          points={earningsTrend}
          loading={analyticsQuery.isPending}
          error={analyticsQuery.isError}
          hasData={Boolean(transactions || videoReferrals)}
          onRetry={analyticsRetry}
        />
        <StatusMix
          statuses={statuses}
          loading={analyticsQuery.isPending}
          error={analyticsQuery.isError}
          hasData={Boolean(pipeline)}
          onRetry={analyticsRetry}
        />
        <ActivityList
          transactions={transactions}
          loading={analyticsQuery.isPending}
          error={analyticsQuery.isError}
          hasData={Boolean(transactions)}
          onRetry={analyticsRetry}
        />
        <ReferralNetwork
          tab={referralTab}
          onSelectTab={setReferralTab}
          users={users}
          orders={referralOrders}
          videoReferrals={videoReferrals}
          profileLoading={profileDashboardQuery.isPending}
          profileError={profileDashboardQuery.isError}
          profileHasData={Boolean(profileDashboard)}
          analyticsLoading={analyticsQuery.isPending}
          analyticsError={analyticsQuery.isError}
          analyticsHasData={Boolean(analytics)}
          onRetryProfile={profileRetry}
          onRetryAnalytics={analyticsRetry}
        />

        {!anyData && !analyticsQuery.isPending && !profileQuery.isPending ? (
          <View className="items-center rounded-2xl border border-dashed border-line bg-white px-5 py-8">
            <Ionicons name="bar-chart-outline" size={28} color={colors.muted} />
            <Text className="mt-3 text-[13px] font-bold text-ink">No Data Yet</Text>
            <Text className="mt-1 text-center text-[10px] leading-4 text-muted">
              ড্রপশিপিং শুরু হলে আপনার বিক্রি ও রেফারেল পারফরম্যান্স এখানে দেখা যাবে।
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(dropshipping)')}
              className="mt-4 rounded-xl bg-primary px-4 py-2.5"
            >
              <Text className="text-[10px] font-bold text-white">ড্রপশিপিং হোমে ফিরুন</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default DropshippingMyAnalyticsScreen;
