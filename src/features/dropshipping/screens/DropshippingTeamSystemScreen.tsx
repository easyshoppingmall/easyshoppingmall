import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReferralOrder, ReferralUser, UserProfile } from '../../../api/authApi';
import { useAppSelector } from '../../../store/hooks';
import { colors } from '../../../shared/theme/colors';
import { formatDropshippingNumber, formatDropshippingTaka } from '../api/homeApi';
import {
  dropshippingProfileErrorMessage,
  getDropshippingReferralLink,
} from '../api/profileApi';
import {
  useDropshippingAnalyticsQuery,
  useDropshippingProfileDashboardQuery,
} from '../api/queries';

const EMPTY_REFERRAL_USERS: ReferralUser[] = [];

function dateLabel(value?: string, includeTime = false): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? undefined
    : date.toLocaleString('bn-BD', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
      });
}

function initialFor(value?: string): string {
  return value?.trim() ? Array.from(value.trim())[0]?.toLocaleUpperCase() ?? '' : '';
}

function orderUserId(order: ReferralOrder): string | undefined {
  if (typeof order.userId === 'string') return order.userId;
  return order.userId?._id;
}

function apiAmount(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
}

function profileMembershipStatus(profile?: UserProfile): string | undefined {
  if (typeof profile?.status === 'string' && profile.status.trim()) {
    return profile.status.trim();
  }
  if (profile?.isVerified !== undefined) return profile.isVerified ? 'যাচাইকৃত' : 'যাচাই হয়নি';
  return undefined;
}

function MemberDetailCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 mr-2 min-h-[62px] flex-1 justify-center rounded-xl border border-[#E8E4D9] bg-white px-3 py-2">
      <Text className="text-[9px] text-muted">{label}</Text>
      <Text numberOfLines={1} className="mt-1 text-[12px] font-extrabold text-ink">{value}</Text>
    </View>
  );
}

function TeamMemberRow({
  member,
  expanded,
  orders,
  onToggle,
  onCopyEmail,
}: {
  member: ReferralUser;
  expanded: boolean;
  orders: ReferralOrder[];
  onToggle: () => void;
  onCopyEmail: (email: string) => void;
}) {
  const joinedDate = dateLabel(member.createdAt, true);
  const linkedCommissions = orders
    .map((order) => apiAmount(order.referralBonusAmount))
    .filter((amount): amount is number => amount !== undefined);
  const linkedSales = orders
    .map((order) => apiAmount(order.totalAmt))
    .filter((amount): amount is number => amount !== undefined);
  const hasCommissionData = orders.length > 0 && linkedCommissions.length === orders.length;
  const hasSalesData = orders.length > 0 && linkedSales.length === orders.length;
  const identifier = member.name?.trim() || member.email;
  const email = member.email;

  return (
    <View className="mb-2 overflow-hidden rounded-2xl border border-[#D9EAD9] bg-white">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${identifier ?? 'সদস্য'} ${expanded ? 'বিস্তারিত বন্ধ করুন' : 'বিস্তারিত দেখুন'}`}
        onPress={onToggle}
        className="flex-row items-center px-3 py-3"
      >
        <View className="mr-3 h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-primary-light">
          {member.image ? (
            <Image
              source={{ uri: member.image }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Text className="text-[16px] font-extrabold text-primary">
              {initialFor(identifier) || '—'}
            </Text>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[12px] font-bold text-ink">
            {member.name?.trim() || 'নাম পাওয়া যায়নি'}
          </Text>
          {email ? (
            <View className="mt-1 flex-row items-center">
              <Text numberOfLines={1} className="min-w-0 flex-1 text-[10px] text-muted">
                {email}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${email} কপি করুন`}
                hitSlop={8}
                onPress={(event) => {
                  event.stopPropagation();
                  onCopyEmail(email);
                }}
                className="ml-2 h-7 w-7 items-center justify-center rounded-lg bg-primary-light"
              >
                <Ionicons name="copy-outline" size={13} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
          {member.status ? (
            <Text numberOfLines={1} className="mt-1 text-[9px] font-semibold text-primary">
              {member.status}
            </Text>
          ) : null}
        </View>
        <View className="ml-2 items-end">
          {joinedDate ? (
            <>
              <Text className="text-[8px] text-muted">যোগ দিয়েছেন</Text>
              <Text className="mt-0.5 text-[9px] font-semibold text-ink">{joinedDate}</Text>
            </>
          ) : null}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.primary}
            style={{ marginTop: joinedDate ? 4 : 0 }}
          />
        </View>
      </Pressable>
      {expanded ? (
        <View className="border-t border-[#E8E4D9] bg-[#FBF9F2] px-3 pb-1 pt-3">
          <View className="flex-row">
            <MemberDetailCard label="যোগদানের তারিখ ও সময়" value={joinedDate ?? 'API-তে নেই'} />
            <MemberDetailCard
              label="মোট অর্ডার"
              value={orders.length ? formatDropshippingNumber(orders.length) : 'API-তে নেই'}
            />
          </View>
          {(hasCommissionData || hasSalesData) ? (
            <View className="flex-row">
              {hasCommissionData ? (
                <MemberDetailCard
                  label="মোট কমিশন"
                  value={formatDropshippingTaka(
                    linkedCommissions.reduce((total, amount) => total + amount, 0)
                  )}
                />
              ) : null}
              {hasSalesData ? (
                <MemberDetailCard
                  label="মোট অর্ডার মূল্য"
                  value={formatDropshippingTaka(linkedSales.reduce((total, amount) => total + amount, 0))}
                />
              ) : null}
            </View>
          ) : null}
          {orders.length ? (
            <View className="mb-2 rounded-xl border border-[#E8E4D9] bg-white px-3 py-2">
              <Text className="text-[9px] font-bold text-muted">API-তে থাকা অর্ডার স্ট্যাটাস</Text>
              {orders.map((order) => (
                <View key={order._id} className="mt-1 flex-row items-center justify-between">
                  <Text className="text-[9px] text-muted">{order.orderId ?? order._id}</Text>
                  <Text className="ml-2 text-[9px] font-semibold text-ink">
                    {order.order_status ?? order.payment_status ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  tint,
  iconColor,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
}) {
  return (
    <View className="mb-2 min-h-[104px] w-[48.5%] overflow-hidden rounded-2xl border border-[#D9EAD9] bg-white p-3">
      <View
        className="absolute -right-3 -top-4 h-16 w-16 rounded-full"
        style={{ backgroundColor: tint, opacity: 0.65 }}
      />
      <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: tint }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text numberOfLines={1} className="mt-2 text-[15px] font-extrabold text-ink">{value}</Text>
      <Text numberOfLines={2} className="mt-1 text-[9px] text-muted">{title}</Text>
    </View>
  );
}

function LoadingRows() {
  return (
    <View className="mb-3 rounded-2xl border border-line bg-white px-3">
      {[0, 1, 2].map((row) => (
        <View key={row} className="flex-row items-center border-b border-line py-3">
          <View className="mr-3 h-11 w-11 rounded-full bg-primary-light" />
          <View className="flex-1">
            <View className="h-3 w-2/5 rounded bg-primary-light" />
            <View className="mt-2 h-2.5 w-3/5 rounded bg-primary-light" />
          </View>
        </View>
      ))}
      <View className="items-center py-3">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="mt-2 text-[10px] text-muted">টিমের তথ্য লোড হচ্ছে...</Text>
      </View>
    </View>
  );
}

export function DropshippingTeamSystemScreen() {
  const router = useRouter();
  const sessionUser = useAppSelector((state) => state.auth.user);
  const userId = sessionUser?._id ?? '';
  const query = useDropshippingProfileDashboardQuery();
  const analyticsQuery = useDropshippingAnalyticsQuery();
  const [search, setSearch] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const dashboard = query.data;
  const profile = dashboard?.user ?? sessionUser ?? undefined;
  const referrals = dashboard?.referrals;
  const referralCode = profile?.referralCode;
  const referralLink = getDropshippingReferralLink(referralCode);
  const analytics = analyticsQuery.data?.summary;
  const members = referrals?.users ?? EMPTY_REFERRAL_USERS;
  const memberOrders = useMemo(() => {
    const result = new Map<string, ReferralOrder[]>();
    for (const order of referrals?.orders ?? []) {
      const memberId = orderUserId(order);
      if (!memberId) continue;
      const linkedOrders = result.get(memberId) ?? [];
      linkedOrders.push(order);
      result.set(memberId, linkedOrders);
    }
    return result;
  }, [referrals?.orders]);
  const filteredMembers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return members;
    return members.filter((member) =>
      [member.name, member.email].some((value) => value?.toLocaleLowerCase().includes(term))
    );
  }, [members, search]);

  const copyValue = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert('কপি হয়েছে', `${label} ক্লিপবোর্ডে কপি হয়েছে।`);
    } catch (error) {
      Alert.alert('কপি করা যায়নি', dropshippingProfileErrorMessage(error, `${label} কপি করা যায়নি।`));
    }
  };

  const shareReferral = async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        message: `EasyShoppingMallBD-এ যোগ দিতে আমার রেফারেল লিংক ব্যবহার করুন:\n${referralLink}`,
        url: referralLink,
        title: 'EasyShoppingMallBD referral',
      });
    } catch (error) {
      Alert.alert('শেয়ার করা যায়নি', dropshippingProfileErrorMessage(error, 'রেফারেল লিংক শেয়ার করা যায়নি।'));
    }
  };

  const memberCount = referrals?.count === undefined
    ? '—'
    : formatDropshippingNumber(referrals.count);
  const balance = typeof profile?.balance === 'number' && Number.isFinite(profile.balance)
    ? formatDropshippingTaka(profile.balance)
    : '—';
  const analyticsValue = (value: number | undefined) =>
    value === undefined || !Number.isFinite(value) ? '—' : formatDropshippingTaka(value);
  const retryMessage = dropshippingProfileErrorMessage(
    query.error,
    'টিমের তথ্য লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <FlatList
        data={filteredMembers}
        keyExtractor={(member) => member._id}
        extraData={expandedMemberId}
        renderItem={({ item }) => (
          <TeamMemberRow
            member={item}
            expanded={expandedMemberId === item._id}
            orders={memberOrders.get(item._id) ?? []}
            onToggle={() => setExpandedMemberId((current) => current === item._id ? null : item._id)}
            onCopyEmail={(email) => void copyValue(email, 'ইমেইল')}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-8 pt-3"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching || analyticsQuery.isRefetching}
            onRefresh={() => void Promise.all([query.refetch(), analyticsQuery.refetch()])}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
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
                <Text className="text-[18px] font-extrabold text-ink">টিম স্ট্যাটাস</Text>
                <View className="mt-1.5 h-1 w-14 rounded-full bg-primary" />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="টিমের তথ্য আবার লোড করুন"
                onPress={() => void Promise.all([query.refetch(), analyticsQuery.refetch()])}
                className="h-10 w-10 items-center justify-center rounded-xl bg-primary-light"
              >
                {query.isRefetching || analyticsQuery.isRefetching
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Ionicons name="refresh-outline" size={18} color={colors.primary} />}
              </Pressable>
            </View>

            {query.isError || analyticsQuery.isError ? (
              <View className="mb-3 flex-row items-center rounded-2xl border border-red-100 bg-red-50 p-3">
                <Ionicons name="alert-circle-outline" size={19} color="#B42318" />
                <Text className="ml-2 flex-1 text-[10px] leading-4 text-red-700">
                  {query.isError ? retryMessage : 'আয়ের সারসংক্ষেপ লোড করা যায়নি।'}
                </Text>
                <Pressable
                  onPress={() => void Promise.all([query.refetch(), analyticsQuery.refetch()])}
                  className="ml-2 rounded-lg bg-white px-3 py-2"
                >
                  <Text className="text-[9px] font-bold text-primary">আবার চেষ্টা</Text>
                </Pressable>
              </View>
            ) : null}

            <View className="mb-4 overflow-hidden rounded-[22px] border border-[#D9EAD9] bg-white p-4">
              <View className="flex-row items-center">
                <View className="mr-3 h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-full border-2 border-primary-light bg-primary-light">
                  {profile?.image ? (
                    <Image
                      source={{ uri: profile.image }}
                      contentFit="cover"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <Text className="text-[22px] font-extrabold text-primary">
                      {initialFor(profile?.name) || '—'}
                    </Text>
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[15px] font-extrabold text-ink">
                    {profile?.name?.trim() || 'নাম পাওয়া যায়নি'}
                  </Text>
                  {profileMembershipStatus(profile) ? (
                    <View className="mt-1.5 self-start rounded-full bg-[#EAF7EE] px-2.5 py-1">
                      <Text className="text-[9px] font-bold text-[#16834A]">
                        {profileMembershipStatus(profile)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View className="ml-2 items-end">
                  <Text className="text-[9px] text-muted">বর্তমান ব্যালেন্স</Text>
                  <Text numberOfLines={1} className="mt-1 text-[12px] font-extrabold text-primary">
                    {query.isPending ? '…' : balance}
                  </Text>
                </View>
              </View>

              <View className="mt-4 flex-row items-center rounded-xl bg-[#F5F9FC] px-3 py-2.5">
                <View className="flex-1">
                  <Text className="text-[9px] font-semibold text-muted">রেফারেল কোড</Text>
                  <Text selectable className="mt-1 text-[14px] font-black tracking-wider text-ink">
                    {referralCode || 'API-তে নেই'}
                  </Text>
                </View>
                {referralCode ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="রেফারেল কোড কপি করুন"
                    onPress={() => void copyValue(referralCode, 'রেফারেল কোড')}
                    className="h-9 w-9 items-center justify-center rounded-lg bg-primary-light"
                  >
                    <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
              {referralLink ? (
                <View className="mt-2 flex-row">
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void copyValue(referralLink, 'রেফারেল লিংক')}
                    className="mr-2 flex-1 flex-row items-center justify-center rounded-xl bg-primary-light py-2.5"
                  >
                    <Ionicons name="link-outline" size={15} color={colors.primary} />
                    <Text className="ml-1.5 text-[10px] font-bold text-primary">লিংক কপি</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void shareReferral()}
                    className="flex-1 flex-row items-center justify-center rounded-xl bg-primary py-2.5"
                  >
                    <Ionicons name="share-social-outline" size={15} color="#FFFFFF" />
                    <Text className="ml-1.5 text-[10px] font-bold text-white">শেয়ার</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View className="mb-1 flex-row flex-wrap justify-between">
              <SummaryCard
                title="সরাসরি যুক্ত সদস্য"
                value={query.isPending ? '…' : memberCount}
                icon="people-outline"
                tint="bg-primary-light"
                iconColor={colors.primary}
              />
              <SummaryCard
                title="বর্তমান ব্যালেন্স"
                value={query.isPending ? '…' : balance}
                icon="wallet-outline"
                tint="bg-tint-yellow"
                iconColor="#A15C07"
              />
              <SummaryCard
                title="রেফারেল কমিশন"
                value={analyticsQuery.isPending ? '…' : analyticsValue(analytics?.referralIncome)}
                icon="cash-outline"
                tint="bg-tint-green"
                iconColor="#087443"
              />
              <SummaryCard
                title="মোট লাভ"
                value={analyticsQuery.isPending ? '…' : analyticsValue(analytics?.totalProfit)}
                icon="trending-up-outline"
                tint="bg-tint-blue"
                iconColor={colors.primary}
              />
              <SummaryCard
                title="অপেক্ষমাণ লাভ"
                value={analyticsQuery.isPending ? '…' : analyticsValue(analytics?.pendingProfit)}
                icon="time-outline"
                tint="bg-tint-orange"
                iconColor="#B54708"
              />
            </View>

            <View className="mb-2 mt-2 flex-row items-center justify-between">
              <Text className="text-[14px] font-extrabold text-ink">টিম সদস্য</Text>
              <Text className="rounded-full bg-primary-light px-2.5 py-1 text-[10px] font-bold text-primary">
                {referrals?.count === undefined ? '—' : memberCount}
              </Text>
            </View>
            <View className="mb-3 flex-row items-center rounded-xl border border-line bg-white px-3">
              <Ionicons name="search-outline" size={17} color={colors.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="নাম বা ইমেইল দিয়ে খুঁজুন"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                className="ml-2 min-h-11 flex-1 py-2 text-[11px] text-ink"
              />
              {search ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="সার্চ মুছুন"
                  onPress={() => setSearch('')}
                  className="h-8 w-8 items-center justify-center"
                >
                  <Ionicons name="close-circle" size={17} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            {query.isPending ? <LoadingRows /> : null}
            {search.trim() && filteredMembers.length > 0 ? (
              <Text className="mb-2 text-[9px] text-muted">
                {formatDropshippingNumber(filteredMembers.length)}টি মিলে যাওয়া সদস্য · সার্চ শুধু API-তে আসা সদস্যের মধ্যে
              </Text>
            ) : null}
            {query.isError && members.length === 0 ? (
              <View className="mb-3 flex-row items-center rounded-xl border border-red-100 bg-red-50 p-3">
                <Ionicons name="alert-circle-outline" size={17} color="#B42318" />
                <Text className="ml-2 flex-1 text-[10px] text-red-700">{retryMessage}</Text>
                <Pressable onPress={() => void query.refetch()} className="ml-2 px-2 py-2">
                  <Text className="text-[9px] font-bold text-primary">আবার চেষ্টা</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isPending || query.isError ? undefined : (
            <View className="items-center rounded-2xl border border-[#D9EAD9] bg-white px-4 py-7">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary-light">
                <Ionicons
                  name={referrals?.users === undefined ? 'information-circle-outline' : search ? 'search-outline' : 'people-outline'}
                  size={23}
                  color={colors.primary}
                />
              </View>
              <Text className="mt-3 text-[12px] font-bold text-ink">
                {referrals?.users === undefined
                  ? 'API-তে সদস্যের তালিকা পাওয়া যায়নি'
                  : search
                    ? 'কোনো সদস্য মেলেনি'
                    : 'এখনো কোনো টিম সদস্য নেই'}
              </Text>
              <Text className="mt-1 text-center text-[10px] leading-4 text-muted">
                {referrals?.users === undefined
                  ? 'সদস্যের তালিকা API response-এ পাওয়া গেলে এখানে দেখা যাবে।'
                  : search
                    ? 'অন্য নাম বা ইমেইল দিয়ে আবার খুঁজুন।'
                    : 'আপনার referral code দিয়ে signup করা সদস্যরা এখানে দেখা যাবে।'}
              </Text>
            </View>
          )
        }
      />
      {!userId ? (
        <View className="absolute inset-0 items-center justify-center bg-bg px-6">
          <Text className="text-center text-[12px] text-muted">লগইন করা Dropshipping অ্যাকাউন্ট পাওয়া যায়নি।</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
