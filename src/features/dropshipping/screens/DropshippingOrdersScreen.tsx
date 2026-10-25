import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DropshippingOrderSummary } from '../api/profileApi';
import { formatDropshippingNumber, formatDropshippingTaka } from '../api/homeApi';
import { useDropshippingOrdersQuery } from '../api/queries';
import { colors } from '../../../shared/theme/colors';

const PAGE_SIZE = 8;
const EMPTY_ORDERS: DropshippingOrderSummary[] = [];

const FILTERS = [
  { label: 'সব অর্ডার', value: 'all' },
  { label: 'পেন্ডিং', value: 'pending' },
  { label: 'প্রসেসিং', value: 'processing' },
  { label: 'পাঠানো হয়েছে', value: 'shipped' },
  { label: 'ডেলিভারি সম্পন্ন', value: 'delivered' },
  { label: 'বাতিল', value: 'cancelled' },
  { label: 'সম্পন্ন', value: 'completed' },
  { label: 'রিটার্ন', value: 'return' },
] as const;

type StatusFilter = (typeof FILTERS)[number]['value'];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function amount(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function productsOf(order: Record<string, unknown>): Record<string, unknown>[] {
  const items = Array.isArray(order.products)
    ? order.products
    : Array.isArray(order.items)
      ? order.items
      : [];
  return items.map(asRecord);
}

function productOf(line: Record<string, unknown>): Record<string, unknown> {
  return asRecord(line.product ?? line.productId ?? line.productDetails);
}

function orderStatus(order: Record<string, unknown>): string {
  return text(order.order_status ?? order.status).toLowerCase().replace(/[\s-]+/g, '_');
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'পেন্ডিং',
    processing: 'প্রসেসিং',
    shipped: 'পাঠানো হয়েছে',
    dispatched: 'পাঠানো হয়েছে',
    delivered: 'ডেলিভারি সম্পন্ন',
    completed: 'সম্পন্ন',
    cancelled: 'বাতিল',
    canceled: 'বাতিল',
    return: 'রিটার্ন',
    returned: 'রিটার্ন',
    return_requested: 'রিটার্ন অনুরোধ',
    returned_to_seller: 'রিটার্ন',
  };
  return labels[status] ?? (status ? 'অন্যান্য' : 'তথ্য নেই');
}

function statusColor(status: string): { text: string; background: string } {
  if (['delivered', 'completed'].includes(status)) {
    return { text: '#087443', background: '#EAF7EE' };
  }
  if (['cancelled', 'canceled', 'return', 'returned', 'return_requested'].includes(status)) {
    return { text: '#B42318', background: '#FDECEF' };
  }
  if (['shipped', 'dispatched'].includes(status)) {
    return { text: '#175CD3', background: '#E5F4FD' };
  }
  return { text: '#B54708', background: '#FFF1E0' };
}

function paymentLabel(value: unknown): string {
  const status = text(value).toLowerCase();
  const labels: Record<string, string> = {
    pending: 'অপেক্ষমাণ',
    submitted: 'যাচাই চলছে',
    paid: 'পরিশোধিত',
    failed: 'ব্যর্থ',
    refunded: 'ফেরত',
    partial: 'আংশিক পরিশোধিত',
  };
  return labels[status] ?? 'তথ্য নেই';
}

function paymentMethodLabel(value: unknown): string {
  const method = text(value).toLowerCase();
  const labels: Record<string, string> = {
    manual: 'ম্যানুয়াল পেমেন্ট',
    cod: 'ক্যাশ অন ডেলিভারি',
    bkash: 'বিকাশ',
    nagad: 'নগদ',
    rocket: 'রকেট',
    upay: 'উপায়',
  };
  return labels[method] ?? 'তথ্য নেই';
}

function orderDate(order: Record<string, unknown>): string {
  const value = order.createdAt ?? order.created_at ?? order.orderDate;
  if (typeof value !== 'string' || !value) return 'তারিখ নেই';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'তারিখ নেই'
    : date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function lineSale(line: Record<string, unknown>, product: Record<string, unknown>) {
  return amount(line.sellingPrice ?? line.selling_price ?? line.price ?? product.price);
}

function lineCost(line: Record<string, unknown>, product: Record<string, unknown>) {
  return amount(
    line.costPrice ??
      line.cost_price ??
      line.purchasePrice ??
      line.purchase_price ??
      line.dropshippingPrice ??
      product.dropshippingPrice
  );
}

function profitForOrder(order: Record<string, unknown>): number | undefined {
  const explicit = amount(order.profit ?? order.estimatedProfit);
  if (explicit !== undefined) return explicit;
  const products = productsOf(order);
  if (!products.length) return undefined;
  let total = 0;
  for (const line of products) {
    const product = productOf(line);
    const sellingPrice = lineSale(line, product);
    const costPrice = lineCost(line, product);
    const quantity = amount(line.quantity);
    if (sellingPrice === undefined || costPrice === undefined || quantity === undefined) {
      return undefined;
    }
    total += (sellingPrice - costPrice) * quantity;
  }
  return total;
}

function customerInfo(order: Record<string, unknown>) {
  const address = asRecord(order.delivery_address ?? order.address ?? order.shippingAddress);
  const customer = asRecord(order.userId ?? order.user ?? order.customer);
  return {
    name: text(address.customer_name ?? address.name ?? customer.name),
    phone: text(address.mobile ?? address.phone ?? customer.mobile ?? customer.phone),
  };
}

function firstProduct(order: Record<string, unknown>) {
  const line = productsOf(order)[0] ?? {};
  const product = productOf(line);
  const imageValue = line.image ?? line.images ?? product.images ?? product.image;
  const image = Array.isArray(imageValue) ? text(imageValue[0]) : text(imageValue);
  return {
    line,
    product,
    image,
    name: text(line.name ?? line.productName ?? product.productName ?? product.name),
    quantity: amount(line.quantity),
  };
}

function referenceId(order: Record<string, unknown>): string {
  return text(order._id ?? order.id);
}

function displayedId(order: Record<string, unknown>): string {
  return text(order.orderId ?? order.orderNumber ?? order._id ?? order.id) || 'আইডি নেই';
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
    <View className="mb-2 mr-2 min-h-[94px] flex-1 rounded-2xl border border-line bg-white p-3">
      <View className={`h-8 w-8 items-center justify-center rounded-xl ${tint}`}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text numberOfLines={1} className="mt-2 text-[15px] font-extrabold text-ink">{value}</Text>
      <Text numberOfLines={1} className="mt-0.5 text-[10px] text-muted">{title}</Text>
    </View>
  );
}

function OrderCard({
  order,
  onPress,
}: {
  order: DropshippingOrderSummary;
  onPress: () => void;
}) {
  const raw = order as Record<string, unknown>;
  const item = firstProduct(raw);
  const customer = customerInfo(raw);
  const status = orderStatus(raw);
  const badge = statusColor(status);
  const payment = asRecord(raw.payment_details ?? raw.paymentDetails);
  const manualPayment = asRecord(payment.manual);
  const paymentMethod = manualPayment.provider ?? payment.provider ?? raw.payment_method ?? raw.paymentMethod;
  const paymentStatus = raw.payment_status ?? raw.paymentStatus;
  const sellingPrice = lineSale(item.line, item.product);
  const costPrice = lineCost(item.line, item.product);
  const profit = profitForOrder(raw);
  const totalQuantity = productsOf(raw).reduce(
    (total, line) => total + (amount(line.quantity) ?? 0),
    0
  );

  return (
    <View className="mb-3 rounded-2xl border border-line bg-white p-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${displayedId(raw)} অর্ডারের বিস্তারিত দেখুন`}
        onPress={onPress}
      >
      <View className="flex-row items-start">
        <View className="mr-3 h-[70px] w-[70px] items-center justify-center overflow-hidden rounded-xl bg-primary-light">
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={referenceId(raw)}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Ionicons name="cube-outline" size={25} color={colors.primary} />
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-start">
            <Text numberOfLines={2} className="flex-1 text-[12px] font-bold leading-[18px] text-ink">
              {item.name || 'পণ্যের নাম নেই'}
            </Text>
            <View style={{ backgroundColor: badge.background }} className="ml-2 rounded-full px-2 py-1">
              <Text style={{ color: badge.text }} className="text-[9px] font-bold">
                {statusLabel(status)}
              </Text>
            </View>
          </View>
          <Text numberOfLines={1} className="mt-1 text-[10px] text-muted">
            অর্ডার: {displayedId(raw)}
          </Text>
          <Text numberOfLines={1} className="mt-1 text-[10px] text-muted">
            {customer.name || 'গ্রাহকের নাম নেই'}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </Text>
          <Text className="mt-1 text-[9px] text-muted">{orderDate(raw)}</Text>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap border-t border-line pt-3">
        <View className="mb-2 w-1/2 pr-2">
          <Text className="text-[9px] text-muted">পেমেন্ট</Text>
          <Text numberOfLines={1} className="mt-1 text-[10px] font-semibold text-ink">
            {paymentLabel(paymentStatus)}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-[9px] text-muted">
            {paymentMethodLabel(paymentMethod)}
          </Text>
        </View>
        <View className="mb-2 w-1/2">
          <Text className="text-[9px] text-muted">পরিমাণ</Text>
          <Text className="mt-1 text-[10px] font-semibold text-ink">
            {totalQuantity ? `${formatDropshippingNumber(totalQuantity)}টি` : 'তথ্য নেই'}
          </Text>
        </View>
        <View className="w-1/3 pr-1">
          <Text className="text-[9px] text-muted">ক্রয়মূল্য</Text>
          <Text numberOfLines={1} className="mt-1 text-[10px] font-bold text-ink">
            {costPrice === undefined ? '—' : formatDropshippingTaka(costPrice)}
          </Text>
        </View>
        <View className="w-1/3 px-1">
          <Text className="text-[9px] text-muted">বিক্রয়মূল্য</Text>
          <Text numberOfLines={1} className="mt-1 text-[10px] font-bold text-ink">
            {sellingPrice === undefined ? '—' : formatDropshippingTaka(sellingPrice)}
          </Text>
        </View>
        <View className="w-1/3 pl-1">
          <Text className="text-[9px] text-muted">সম্ভাব্য লাভ</Text>
          <Text numberOfLines={1} className="mt-1 text-[10px] font-extrabold text-emerald-700">
            {profit === undefined ? '—' : formatDropshippingTaka(profit)}
          </Text>
        </View>
      </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="mt-3 flex-row items-center justify-center rounded-xl bg-primary-light px-3 py-2.5"
      >
        <Text className="text-[10px] font-bold text-primary">অর্ডারের বিস্তারিত দেখুন</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-line bg-white px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-light">
        <Ionicons name={searching ? 'search-outline' : 'receipt-outline'} size={26} color={colors.primary} />
      </View>
      <Text className="mt-3 text-[13px] font-bold text-ink">
        {searching ? 'কোনো অর্ডার মেলেনি' : 'এখনো কোনো অর্ডার নেই'}
      </Text>
      <Text className="mt-1 text-center text-[10px] leading-4 text-muted">
        {searching
          ? 'অন্য অর্ডার নম্বর, গ্রাহকের নাম বা ফোন নম্বর দিয়ে খুঁজুন।'
          : 'নতুন অর্ডার তৈরি হলে এখানে দেখা যাবে।'}
      </Text>
    </View>
  );
}

function OrderListSkeleton() {
  return (
    <View>
      {[0, 1, 2].map((item) => (
        <View key={item} className="mb-3 rounded-2xl border border-line bg-white p-3.5">
          <View className="flex-row">
            <View className="mr-3 h-[70px] w-[70px] rounded-xl bg-slate-200" />
            <View className="flex-1 pt-1">
              <View className="h-3 w-3/4 rounded bg-slate-200" />
              <View className="mt-2 h-2.5 w-1/2 rounded bg-slate-100" />
              <View className="mt-2 h-2.5 w-2/3 rounded bg-slate-100" />
              <View className="mt-2 h-2 w-1/3 rounded bg-slate-100" />
            </View>
          </View>
          <View className="mt-3 h-px bg-line" />
          <View className="mt-3 flex-row justify-between">
            <View className="h-7 w-[28%] rounded bg-slate-100" />
            <View className="h-7 w-[28%] rounded bg-slate-100" />
            <View className="h-7 w-[28%] rounded bg-slate-100" />
          </View>
        </View>
      ))}
      <View className="flex-row items-center justify-center py-3">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="ml-2 text-[10px] text-muted">অর্ডার লোড হচ্ছে...</Text>
      </View>
    </View>
  );
}

export function DropshippingOrdersScreen() {
  const router = useRouter();
  const ordersQuery = useDropshippingOrdersQuery();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const orders = ordersQuery.data ?? EMPTY_ORDERS;
  const summary = useMemo(() => {
    const records = orders as Record<string, unknown>[];
    const profits = records.map(profitForOrder);
    const totalProfit = profits.every((value) => value !== undefined)
      ? profits.reduce<number>((total, value) => total + (value ?? 0), 0)
      : undefined;
    return {
      total: records.length,
      delivered: records.filter((order) =>
        ['delivered', 'completed'].includes(orderStatus(order))
      ).length,
      processing: records.filter((order) => orderStatus(order) === 'processing').length,
      pending: records.filter((order) => orderStatus(order) === 'pending').length,
      totalProfit,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = debouncedSearch;
    return orders.filter((order) => {
      const raw = order as Record<string, unknown>;
      const status = orderStatus(raw);
      const statusMatches = statusFilter === 'all'
        ? true
        : statusFilter === 'completed'
          ? status === 'completed'
          : statusFilter === 'return'
            ? ['return', 'returned', 'return_requested', 'returned_to_seller'].includes(status)
            : statusFilter === 'cancelled'
              ? ['cancelled', 'canceled'].includes(status)
              : statusFilter === 'shipped'
                ? ['shipped', 'dispatched'].includes(status)
                : status === statusFilter;
      if (!statusMatches) return false;
      if (!query) return true;
      const customer = customerInfo(raw);
      const productNames = productsOf(raw).map((line) => {
        const product = productOf(line);
        return text(line.name ?? line.productName ?? product.productName ?? product.name);
      });
      const searchable = [
        displayedId(raw),
        referenceId(raw),
        customer.name,
        customer.phone,
        ...productNames,
      ].join(' ').toLocaleLowerCase();
      return searchable.includes(query);
    });
  }, [debouncedSearch, orders, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const header = (
    <View>
      <View className="mb-4 flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ফিরে যান"
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[18px] font-extrabold text-ink">অর্ডার তালিকা</Text>
          <Text className="mt-0.5 text-[10px] text-muted">আপনার ড্রপশিপিং অর্ডারগুলো এক নজরে</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="অর্ডার আবার লোড করুন"
          onPress={() => void ordersQuery.refetch()}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary-light"
        >
          {ordersQuery.isRefetching
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh-outline" size={19} color={colors.primary} />}
        </Pressable>
      </View>

      <Text className="mb-2 text-[13px] font-extrabold text-ink">অর্ডার সারসংক্ষেপ</Text>
      <View className="mb-2 flex-row">
        <SummaryCard title="মোট অর্ডার" value={formatDropshippingNumber(summary.total)} icon="receipt-outline" tint="bg-primary-light" iconColor={colors.primary} />
        <SummaryCard title="ডেলিভারি সম্পন্ন" value={formatDropshippingNumber(summary.delivered)} icon="checkmark-circle-outline" tint="bg-tint-green" iconColor="#087443" />
      </View>
      <View className="mb-4 flex-row">
        <SummaryCard title="প্রসেসিংয়ে" value={formatDropshippingNumber(summary.processing)} icon="sync-outline" tint="bg-tint-orange" iconColor="#B54708" />
        <SummaryCard title="পেন্ডিং অর্ডার" value={formatDropshippingNumber(summary.pending)} icon="time-outline" tint="bg-tint-purple" iconColor="#6941C6" />
      </View>
      <View className="mb-4 flex-row items-center rounded-2xl border border-emerald-100 bg-white px-4 py-3">
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-tint-green">
          <Ionicons name="trending-up-outline" size={20} color="#087443" />
        </View>
        <View className="flex-1">
          <Text className="text-[10px] text-muted">মোট লাভ</Text>
          <Text className="mt-1 text-[16px] font-extrabold text-emerald-700">
            {summary.totalProfit === undefined ? '—' : formatDropshippingTaka(summary.totalProfit)}
          </Text>
        </View>
      </View>

      <View className="mb-3 h-11 flex-row items-center rounded-xl border border-line bg-white px-3">
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="অর্ডার, গ্রাহক, ফোন বা পণ্য খুঁজুন"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          returnKeyType="search"
          className="ml-2 flex-1 py-2 text-[11px] text-ink"
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="খোঁজার লেখা মুছুন"
            onPress={() => {
              setSearch('');
              setPage(1);
            }}
            className="p-1"
          >
            <Ionicons name="close-circle" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <Text className="mb-2 text-[12px] font-bold text-ink">অবস্থা অনুযায়ী</Text>
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(filter) => filter.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
        renderItem={({ item }) => {
          const selected = item.value === statusFilter;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setStatusFilter(item.value);
                setPage(1);
              }}
              className={`mr-2 rounded-full border px-3.5 py-2 ${selected ? 'border-primary bg-primary' : 'border-line bg-white'}`}
            >
              <Text className={`text-[10px] font-bold ${selected ? 'text-white' : 'text-muted'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[13px] font-extrabold text-ink">আপনার অর্ডার</Text>
        {!ordersQuery.isPending && !ordersQuery.isError ? (
          <Text className="text-[10px] text-muted">
            {formatDropshippingNumber(filteredOrders.length)}টি অর্ডার
          </Text>
        ) : null}
      </View>

      {ordersQuery.isError ? (
        <View className="mb-3 flex-row items-center rounded-2xl border border-red-100 bg-red-50 p-3.5">
          <Ionicons name="alert-circle-outline" size={20} color="#B42318" />
          <View className="ml-2 flex-1">
            <Text className="text-[11px] font-bold text-red-800">অর্ডার লোড করা যায়নি</Text>
            <Text className="mt-1 text-[10px] leading-4 text-red-700">
              {ordersQuery.error instanceof Error ? ordersQuery.error.message : 'আবার চেষ্টা করুন।'}
            </Text>
          </View>
          <Pressable onPress={() => void ordersQuery.refetch()} className="ml-2 rounded-lg bg-white px-3 py-2">
            <Text className="text-[10px] font-bold text-primary">আবার চেষ্টা</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <FlatList
        data={visibleOrders}
        keyExtractor={(order, index) =>
          referenceId(order as Record<string, unknown>) ||
          displayedId(order as Record<string, unknown>) ||
          `order-${index}`
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => {
              const id = referenceId(item as Record<string, unknown>);
              if (id) router.push({ pathname: '/(dropshipping)/order/[id]', params: { id } });
            }}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          ordersQuery.isPending
            ? <OrderListSkeleton />
            : ordersQuery.isError
              ? undefined
              : <EmptyState searching={Boolean(debouncedSearch) || statusFilter !== 'all'} />
        }
        ListFooterComponent={pageCount > 1 ? (
          <View className="mb-8 mt-1 flex-row items-center justify-between rounded-xl bg-white px-3 py-2">
            <Pressable
              disabled={currentPage <= 1}
              onPress={() => setPage((current) => Math.max(1, current - 1))}
              className={`flex-row items-center rounded-lg px-3 py-2 ${currentPage <= 1 ? 'opacity-40' : 'bg-primary-light'}`}
            >
              <Ionicons name="chevron-back" size={15} color={colors.primary} />
              <Text className="ml-1 text-[10px] font-bold text-primary">আগের পৃষ্ঠা</Text>
            </Pressable>
            <Text className="text-[10px] font-semibold text-muted">
              {formatDropshippingNumber(currentPage)} / {formatDropshippingNumber(pageCount)}
            </Text>
            <Pressable
              disabled={currentPage >= pageCount}
              onPress={() => setPage((current) => Math.min(pageCount, current + 1))}
              className={`flex-row items-center rounded-lg px-3 py-2 ${currentPage >= pageCount ? 'opacity-40' : 'bg-primary-light'}`}
            >
              <Text className="mr-1 text-[10px] font-bold text-primary">পরের পৃষ্ঠা</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </Pressable>
          </View>
        ) : <View className="h-6" />}
        refreshControl={
          <RefreshControl
            refreshing={ordersQuery.isRefetching}
            onRefresh={() => void ordersQuery.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
      />
    </SafeAreaView>
  );
}
