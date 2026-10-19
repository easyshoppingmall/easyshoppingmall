import React from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { customerApi, responseMessage } from '../api/customerApi';
import { formatTaka, isRemoteImage, toBengaliNumber } from '../data/catalog';
import { colors } from '../../../shared/theme/colors';

function safeRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function statusLabel(value: unknown): string {
  const status = String(value ?? '').toLowerCase();
  const labels: Record<string, string> = {
    pending: 'অপেক্ষমাণ',
    processing: 'প্রস্তুত হচ্ছে',
    shipped: 'পাঠানো হয়েছে',
    delivered: 'ডেলিভারি সম্পন্ন',
    completed: 'সম্পন্ন',
    cancelled: 'বাতিল',
    return: 'ফেরত',
    submitted: 'যাচাইয়ের অপেক্ষায়',
    paid: 'পরিশোধিত',
    failed: 'ব্যর্থ',
    refunded: 'ফেরত দেওয়া হয়েছে',
  };
  return labels[status] ?? (text(value) || 'তথ্য নেই');
}

function formatDate(value: unknown): string {
  if (!value) return 'তারিখ নেই';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? 'তারিখ নেই'
    : date.toLocaleString('bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="mb-2 flex-row items-start justify-between">
      <Text className="mr-3 text-[11px] text-muted">{label}</Text>
      <Text className={`flex-1 text-right text-[11px] ${strong ? 'font-extrabold text-primary' : 'font-semibold text-ink'}`}>
        {value}
      </Text>
    </View>
  );
}

export const OrderDetailsScreen: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderQuery = useQuery({
    queryKey: ['customer', 'order', id],
    queryFn: () => {
      if (!id) throw new Error('অর্ডার আইডি পাওয়া যায়নি।');
      return customerApi.getOrder(id);
    },
    enabled: Boolean(id),
  });

  if (orderQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color={colors.success} />
        <Text className="mt-3 text-[12px] text-muted">অর্ডারের বিস্তারিত আনা হচ্ছে...</Text>
      </SafeAreaView>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <Ionicons name="alert-circle-outline" size={27} color={colors.accent} />
        </View>
        <Text className="mt-3 text-center text-[14px] font-bold text-ink">অর্ডারের তথ্য পাওয়া যায়নি</Text>
        <Text className="mt-2 text-center text-[11px] leading-5 text-red-700">
          {orderQuery.error
            ? responseMessage(orderQuery.error, 'অর্ডার লোড করা যায়নি।')
            : 'এই অর্ডারটি খুঁজে পাওয়া যায়নি।'}
        </Text>
        <TouchableOpacity
          onPress={() => void orderQuery.refetch()}
          className="mt-4 rounded-xl bg-primary px-5 py-3"
        >
          <Text className="text-[11px] font-bold text-white">আবার চেষ্টা করুন</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-2 rounded-xl px-5 py-3">
          <Text className="text-[11px] font-bold text-primary">অর্ডার তালিকায় ফিরুন</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const order = orderQuery.data as Record<string, unknown>;
  const orderItems = Array.isArray(order.products)
    ? order.products
    : Array.isArray(order.items)
      ? order.items
      : [];
  const address = safeRecord(order.address ?? order.shippingAddress);
  const customer = safeRecord(order.userId ?? order.user);
  const paymentDetails = safeRecord(order.payment_details ?? order.paymentDetails);
  const manualPayment = safeRecord(paymentDetails.manual ?? paymentDetails);
  const orderId = text(order.orderId ?? order.orderNumber ?? order._id ?? id) || 'আইডি নেই';
  const subtotal = Number(order.subTotalAmt ?? order.subtotal ?? order.subTotal) || 0;
  const deliveryCharge = Number(order.deliveryCharge ?? order.shippingCost) || 0;
  const discount = Number(order.couponDiscount ?? order.discountAmount ?? order.discount) || 0;
  const calculatedTotal = Math.max(0, subtotal + deliveryCharge - discount);
  const total = Number(order.totalAmt ?? order.totalAmount ?? order.totalPrice) || calculatedTotal;
  const paid = Number(order.amount_paid ?? order.amountPaid) || 0;
  const due = Number(order.amount_due ?? order.amountDue ?? order.dueAmount) || 0;
  const paymentType = order.payment_type === 'delivery'
    ? 'শুধু ডেলিভারি চার্জ'
    : order.payment_type === 'full'
      ? 'সম্পূর্ণ পেমেন্ট'
      : statusLabel(order.payment_type);
  const provider = String(manualPayment.provider ?? '');
  const providerLabel = provider === 'bkash' ? 'বিকাশ' : provider === 'nagad' ? 'নগদ' : provider;
  const addressLines = [
    address.address_line,
    address.upazila_thana,
    address.district,
    address.division,
    address.pincode ? `পোস্ট কোড ${address.pincode}` : '',
    address.country,
  ].map(text).filter(Boolean);
  const createdAt = order.createdAt ?? order.created_at;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="ফিরে যান"
          onPress={() => router.back()}
          className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-bg"
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-[16px] font-extrabold text-ink">অর্ডারের বিস্তারিত</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="তথ্য আবার লোড করুন"
          onPress={() => void orderQuery.refetch()}
          className="h-9 w-9 items-center justify-center rounded-full bg-primary-light"
        >
          {orderQuery.isRefetching
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh-outline" size={18} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-3 rounded-2xl bg-emerald-700 p-4">
          <Text className="text-[10px] font-semibold text-white/75">অর্ডার নম্বর</Text>
          <Text selectable className="mt-1 text-[15px] font-extrabold text-white">{orderId}</Text>
          <Text className="mt-2 text-[10px] text-white/80">{formatDate(createdAt)}</Text>
          <View className="mt-3 flex-row">
            <View className="mr-2 flex-1 rounded-xl bg-white/15 px-3 py-2.5">
              <Text className="text-[9px] text-white/75">ডেলিভারির অবস্থা</Text>
              <Text className="mt-1 text-[11px] font-bold text-white">
                {statusLabel(order.order_status ?? order.status)}
              </Text>
            </View>
            <View className="ml-2 flex-1 rounded-xl bg-white/15 px-3 py-2.5">
              <Text className="text-[9px] text-white/75">পেমেন্টের অবস্থা</Text>
              <Text className="mt-1 text-[11px] font-bold text-white">
                {statusLabel(order.payment_status ?? order.paymentStatus)}
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-3 rounded-2xl border border-line bg-white p-4">
          <View className="mb-3 flex-row items-center">
            <Ionicons name="bag-handle-outline" size={18} color={colors.primary} />
            <Text className="ml-2 flex-1 text-[13px] font-extrabold text-ink">অর্ডারের পণ্য</Text>
            <Text className="text-[10px] font-semibold text-muted">
              {toBengaliNumber(orderItems.length)}টি পণ্য
            </Text>
          </View>
          {orderItems.length ? orderItems.map((value, index) => {
            const line = safeRecord(value);
            const product = safeRecord(line.product ?? line.productId ?? line.productDetails);
            const name = text(line.name ?? line.productName ?? product.productName ?? product.name) || 'পণ্য';
            const quantity = Number(line.quantity) || 1;
            const unitPrice = Number(line.sellingPrice ?? line.price ?? product.price ?? line.amount) || 0;
            const lineTotal = Number(line.totalPrice) || unitPrice * quantity;
            const imageValue = line.image ?? product.images ?? product.image;
            const image = Array.isArray(imageValue) ? imageValue[0] : imageValue;
            const variant = [line.size, line.color, line.weight].map(text).filter(Boolean).join(' · ');
            return (
              <View key={String(line._id ?? index)} className="mb-3 flex-row border-t border-line pt-3">
                <View className="mr-3 h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-primary-light">
                  {typeof image === 'string' && isRemoteImage(image)
                    ? <Image source={{ uri: image }} className="h-full w-full" resizeMode="cover" />
                    : <Ionicons name="cube-outline" size={22} color={colors.primary} />}
                </View>
                <View className="flex-1 justify-center">
                  <Text className="text-[11px] font-bold leading-4 text-ink">{name}</Text>
                  {variant ? <Text className="mt-1 text-[9px] text-muted">{variant}</Text> : null}
                  <Text className="mt-1 text-[10px] text-muted">
                    {formatTaka(unitPrice)} × {toBengaliNumber(quantity)}
                  </Text>
                </View>
                <Text className="ml-2 self-center text-[11px] font-extrabold text-ink">{formatTaka(lineTotal)}</Text>
              </View>
            );
          }) : (
            <Text className="border-t border-line pt-3 text-[11px] leading-5 text-muted">
              এই অর্ডারের পণ্যের তালিকা API থেকে পাওয়া যায়নি।
            </Text>
          )}
        </View>

        <View className="mb-3 rounded-2xl border border-line bg-white p-4">
          <View className="mb-3 flex-row items-center">
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
            <Text className="ml-2 text-[13px] font-extrabold text-ink">মূল্য ও পেমেন্ট</Text>
          </View>
          <DetailRow label="পণ্যের মূল্য" value={formatTaka(subtotal)} />
          <DetailRow label="ডেলিভারি চার্জ" value={formatTaka(deliveryCharge)} />
          {discount > 0 ? <DetailRow label="কুপন ছাড়" value={`− ${formatTaka(discount)}`} /> : null}
          <View className="my-2 h-px bg-line" />
          <DetailRow label="সর্বমোট" value={formatTaka(total)} strong />
          <DetailRow label="পেমেন্টের ধরন" value={paymentType} />
          <DetailRow label="পরিশোধিত" value={formatTaka(paid)} />
          <DetailRow label="বকেয়া" value={formatTaka(due)} />
          {provider || manualPayment.senderNumber || manualPayment.transactionId ? (
            <View className="mt-2 rounded-xl bg-bg p-3">
              <Text className="mb-2 text-[10px] font-bold text-ink">ম্যানুয়াল পেমেন্টের তথ্য</Text>
              {provider ? <DetailRow label="পেমেন্ট মাধ্যম" value={providerLabel} /> : null}
              {manualPayment.senderNumber ? <DetailRow label="প্রেরকের নম্বর" value={String(manualPayment.senderNumber)} /> : null}
              {manualPayment.transactionId ? <DetailRow label="ট্রানজেকশন আইডি" value={String(manualPayment.transactionId)} /> : null}
            </View>
          ) : null}
        </View>

        <View className="mb-3 rounded-2xl border border-line bg-white p-4">
          <View className="mb-3 flex-row items-center">
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text className="ml-2 text-[13px] font-extrabold text-ink">ডেলিভারি ঠিকানা</Text>
          </View>
          <Text className="text-[12px] font-bold text-ink">
            {text(address.customer_name ?? address.name ?? customer.name) || 'গ্রাহকের নাম নেই'}
          </Text>
          {address.mobile ?? address.phone ?? customer.mobile ? (
            <Text className="mt-1 text-[10px] text-muted">
              মোবাইল: {String(address.mobile ?? address.phone ?? customer.mobile)}
            </Text>
          ) : null}
          {addressLines.length ? (
            <Text className="mt-2 text-[11px] leading-5 text-muted">{addressLines.join(', ')}</Text>
          ) : (
            <Text className="mt-2 text-[10px] text-muted">ঠিকানার তথ্য API থেকে পাওয়া যায়নি।</Text>
          )}
        </View>

        {order.appliedCoupon ? (
          <View className="mb-3 flex-row items-center rounded-xl border border-green-100 bg-tint-green p-3">
            <Ionicons name="pricetag-outline" size={17} color={colors.success} />
            <Text className="ml-2 text-[10px] text-ink">
              প্রয়োগ করা কুপন: <Text className="font-bold">{String(order.appliedCoupon)}</Text>
            </Text>
          </View>
        ) : null}

        {order.note || order.orderNote ? (
          <View className="mb-3 rounded-2xl border border-line bg-white p-4">
            <Text className="mb-2 text-[12px] font-bold text-ink">অর্ডার নোট</Text>
            <Text className="text-[11px] leading-5 text-muted">{String(order.note ?? order.orderNote)}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

export default OrderDetailsScreen;
