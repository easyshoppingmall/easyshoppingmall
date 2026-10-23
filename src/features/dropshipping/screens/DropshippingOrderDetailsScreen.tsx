import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAppSelector } from '../../../store/hooks';
import { formatDropshippingNumber, formatDropshippingTaka } from '../api/homeApi';
import {
  dropshippingHomeQueryKeys,
  useDropshippingOrderDetailsQuery,
  useDropshippingProfileQuery,
} from '../api/queries';
import {
  submitDropshippingManualPayment,
  type DropshippingPaymentProvider,
} from '../api/ordersApi';
import { createDropshippingInvoiceHtml } from '../utils/orderInvoice';
import { colors } from '../../../shared/theme/colors';

const PAYMENT_PROVIDERS: { value: DropshippingPaymentProvider; label: string }[] = [
  { value: 'bkash', label: 'বিকাশ' },
  { value: 'nagad', label: 'নগদ' },
  { value: 'rocket', label: 'রকেট' },
  { value: 'upay', label: 'উপায়' },
];

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

function dateLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('bn-BD', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function displayAmount(value: number | undefined): string {
  return value === undefined ? '—' : formatDropshippingTaka(value);
}

function normalizedStatus(value: unknown): string {
  return text(value).toLowerCase().replace(/[\s-]+/g, '_');
}

function orderProducts(order: Record<string, unknown>): Record<string, unknown>[] {
  const values = Array.isArray(order.products)
    ? order.products
    : Array.isArray(order.items)
      ? order.items
      : [];
  return values.map(asRecord);
}

function nestedProduct(item: Record<string, unknown>): Record<string, unknown> {
  return asRecord(item.product ?? item.productId ?? item.productDetails);
}

function linePrice(item: Record<string, unknown>, product: Record<string, unknown>) {
  return amount(item.sellingPrice ?? item.selling_price ?? item.price ?? product.price);
}

function lineCost(item: Record<string, unknown>, product: Record<string, unknown>) {
  return amount(
    item.costPrice ??
      item.cost_price ??
      item.purchasePrice ??
      item.purchase_price ??
      item.dropshippingPrice ??
      product.dropshippingPrice
  );
}

function statusLabel(value: unknown): string {
  const status = text(value).toLowerCase().replace(/[\s-]+/g, '_');
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
    paid: 'পরিশোধিত',
    submitted: 'যাচাই চলছে',
    failed: 'ব্যর্থ',
    refunded: 'ফেরত',
    partial: 'আংশিক পরিশোধিত',
  };
  return labels[status] ?? (status ? 'অন্যান্য' : 'তথ্য নেই');
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

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  return (
    <View className="mb-3 rounded-2xl border border-line bg-white p-4">
      <View className="mb-3 flex-row items-center">
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text className="ml-2 text-[13px] font-extrabold text-ink">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DetailRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="mb-2 flex-row items-start justify-between">
      <Text className="mr-3 text-[10px] text-muted">{label}</Text>
      <Text className={`flex-1 text-right text-[10px] ${strong ? 'font-extrabold text-primary' : 'font-semibold text-ink'}`}>
        {value || 'তথ্য নেই'}
      </Text>
    </View>
  );
}

function productName(item: Record<string, unknown>, product: Record<string, unknown>): string {
  return text(item.name ?? item.productName ?? product.productName ?? product.name) || 'পণ্যের নাম নেই';
}

function productImage(item: Record<string, unknown>, product: Record<string, unknown>): string {
  const value = item.image ?? item.images ?? product.images ?? product.image;
  return Array.isArray(value) ? text(value[0]) : text(value);
}

function productVariant(item: Record<string, unknown>): string {
  const variant = asRecord(item.variant);
  return [
    text(item.size ?? variant.size),
    text(item.color ?? variant.color),
    text(item.weight ?? variant.weight),
  ].filter(Boolean).join(' · ');
}

function sortEvents(events: Record<string, unknown>[]): Record<string, unknown>[] {
  const timestamp = (event: Record<string, unknown>) => {
    const value = event.createdAt ?? event.created_at ?? event.updatedAt ?? event.date ?? event.timestamp;
    const parsed = new Date(String(value ?? '')).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [...events].sort((left, right) => timestamp(right) - timestamp(left));
}

function ItemCard({ item, index }: { item: Record<string, unknown>; index: number }) {
  const product = nestedProduct(item);
  const quantity = amount(item.quantity);
  const price = linePrice(item, product);
  const cost = lineCost(item, product);
  const profit = price !== undefined && cost !== undefined && quantity !== undefined
    ? (price - cost) * quantity
    : undefined;
  const total = amount(item.totalPrice ?? item.total_price) ??
    (price !== undefined && quantity !== undefined ? price * quantity : undefined);
  const image = productImage(item, product);

  return (
    <View className={`flex-row py-3 ${index ? 'border-t border-line' : ''}`}>
      <View className="mr-3 h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-xl bg-primary-light">
        {image ? (
          <Image source={{ uri: image }} contentFit="cover" cachePolicy="memory-disk" style={{ width: '100%', height: '100%' }} />
        ) : (
          <Ionicons name="cube-outline" size={23} color={colors.primary} />
        )}
      </View>
      <View className="flex-1">
        <Text numberOfLines={2} className="text-[11px] font-bold leading-4 text-ink">
          {productName(item, product)}
        </Text>
        {productVariant(item) ? (
          <Text className="mt-1 text-[9px] text-muted">{productVariant(item)}</Text>
        ) : null}
        <Text className="mt-1 text-[9px] text-muted">
          {quantity === undefined ? 'পরিমাণ: তথ্য নেই' : `পরিমাণ: ${formatDropshippingNumber(quantity)}`}
        </Text>
        <Text className="mt-1 text-[9px] text-muted">
          ক্রয় {displayAmount(cost)} · বিক্রয় {displayAmount(price)} · লাভ {displayAmount(profit)}
        </Text>
      </View>
      <Text className="ml-2 self-center text-[10px] font-extrabold text-ink">{displayAmount(total)}</Text>
    </View>
  );
}

export function DropshippingOrderDetailsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionUser = useAppSelector((state) => state.auth.user);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const orderQuery = useDropshippingOrderDetailsQuery(id);
  const profileQuery = useDropshippingProfileQuery();
  const profile = profileQuery.data;
  const [paymentProvider, setPaymentProvider] = useState<DropshippingPaymentProvider>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [invoiceError, setInvoiceError] = useState('');
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const paymentMutation = useMutation({
    mutationFn: () => submitDropshippingManualPayment(
      id,
      paymentProvider,
      senderNumber.trim(),
      transactionId.trim()
    ),
    onSuccess: async () => {
      setPaymentNotice('পেমেন্টের তথ্য জমা হয়েছে। সার্ভারের নিশ্চিতকরণের জন্য অপেক্ষা করুন।');
      setSenderNumber('');
      setTransactionId('');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dropshippingHomeQueryKeys.orderDetails(sessionUser?._id ?? '', id),
        }),
        queryClient.invalidateQueries({
          queryKey: dropshippingHomeQueryKeys.orders(sessionUser?._id ?? ''),
        }),
      ]);
    },
  });

  if (!id.trim()) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <Ionicons name="alert-circle-outline" size={27} color={colors.accent} />
        </View>
        <Text className="mt-3 text-center text-[14px] font-bold text-ink">
          অর্ডার আইডি পাওয়া যায়নি
        </Text>
        <Text className="mt-2 text-center text-[10px] leading-4 text-muted">
          অর্ডার তালিকায় ফিরে সংশ্লিষ্ট অর্ডারটি আবার খুলুন।
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-xl bg-primary px-5 py-3">
          <Text className="text-[10px] font-bold text-white">অর্ডার তালিকায় ফিরুন</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (orderQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-3 text-[11px] text-muted">অর্ডারের বিস্তারিত লোড হচ্ছে...</Text>
      </SafeAreaView>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <Ionicons name="alert-circle-outline" size={27} color={colors.accent} />
        </View>
        <Text className="mt-3 text-center text-[14px] font-bold text-ink">
          অর্ডারের তথ্য পাওয়া যায়নি
        </Text>
        <Text className="mt-2 text-center text-[10px] leading-4 text-red-700">
          {orderQuery.error instanceof Error ? orderQuery.error.message : 'আবার চেষ্টা করুন।'}
        </Text>
        <Pressable onPress={() => void orderQuery.refetch()} className="mt-4 rounded-xl bg-primary px-5 py-3">
          <Text className="text-[10px] font-bold text-white">আবার চেষ্টা করুন</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-2 rounded-xl px-5 py-3">
          <Text className="text-[10px] font-bold text-primary">অর্ডার তালিকায় ফিরুন</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const order = orderQuery.data;
  const address = asRecord(order.delivery_address ?? order.address ?? order.shippingAddress);
  const customer = asRecord(order.userId ?? order.user ?? order.customer);
  const payment = asRecord(order.payment_details ?? order.paymentDetails);
  const paymentInfo = asRecord(payment.manual ?? payment);
  const items = orderProducts(order);
  const status = order.order_status ?? order.status;
  const paymentStatus = order.payment_status ?? order.paymentStatus;
  const idLabel = text(order.orderId ?? order.orderNumber ?? order._id ?? order.id) || id || 'তথ্য নেই';
  const date = dateLabel(order.createdAt ?? order.created_at ?? order.orderDate);
  const subtotal = amount(order.subTotalAmt ?? order.subtotal ?? order.subTotal);
  const deliveryCharge = amount(order.deliveryCharge ?? order.shippingCost);
  const discount = amount(order.couponDiscount ?? order.discountAmount);
  const extraCharge = amount(order.otherCharges ?? order.additionalCharge);
  const itemSales = items.map((item) => {
    const product = nestedProduct(item);
    const price = linePrice(item, product);
    const quantity = amount(item.quantity);
    const explicitTotal = amount(item.totalPrice ?? item.total_price);
    return explicitTotal ?? (price !== undefined && quantity !== undefined ? price * quantity : undefined);
  });
  const calculatedSubtotal = itemSales.every((value) => value !== undefined)
    ? itemSales.reduce<number>((total, value) => total + (value ?? 0), 0)
    : undefined;
  const totalSale = amount(order.totalAmt ?? order.totalAmount ?? order.totalPrice) ??
    (subtotal !== undefined ? subtotal + (deliveryCharge ?? 0) - (discount ?? 0) + (extraCharge ?? 0) : calculatedSubtotal);
  const costValues = items.map((item) => {
    const product = nestedProduct(item);
    const cost = lineCost(item, product);
    const quantity = amount(item.quantity);
    return cost !== undefined && quantity !== undefined ? cost * quantity : undefined;
  });
  const totalProductCost = costValues.length && costValues.every((value) => value !== undefined)
    ? costValues.reduce<number>((total, value) => total + (value ?? 0), 0)
    : undefined;
  const productProfits = items.map((item) => {
    const product = nestedProduct(item);
    const cost = lineCost(item, product);
    const price = linePrice(item, product);
    const quantity = amount(item.quantity);
    return cost !== undefined && price !== undefined && quantity !== undefined
      ? (price - cost) * quantity
      : undefined;
  });
  const calculatedProfit = productProfits.length && productProfits.every((value) => value !== undefined)
    ? productProfits.reduce<number>((total, value) => total + (value ?? 0), 0)
    : undefined;
  const estimatedProfit = amount(order.estimatedProfit ?? order.profit) ?? calculatedProfit;
  const finalProfit = amount(order.finalProfit ?? order.final_profit);
  const addressLines = [
    address.address_line,
    address.upazila_thana,
    address.district,
    address.division,
    address.pincode ? `পোস্ট কোড ${text(address.pincode)}` : '',
    address.country,
  ].map(text).filter(Boolean);
  const customerName = text(address.customer_name ?? address.name ?? customer.name);
  const customerPhone = text(address.mobile ?? address.phone ?? customer.mobile ?? customer.phone);
  const tracking = asRecord(order.tracking);
  const trackingNumber = text(order.trackingNumber ?? order.tracking_number ?? tracking.number ?? tracking.trackingNumber);
  const trackingUrl = text(order.trackingUrl ?? order.tracking_url ?? tracking.url);
  const courier = text(
    order.courier ?? order.courierName ?? order.shippingProvider ?? order.provider ?? tracking.courier
  );
  const notes = text(order.notes ?? order.note ?? order.orderNotes ?? order.order_notes);
  const historyValues = Array.isArray(order.statusHistory)
    ? order.statusHistory
    : Array.isArray(order.statusTimeline)
      ? order.statusTimeline
      : Array.isArray(order.order_status_history)
        ? order.order_status_history
        : [];
  const timeline = sortEvents(historyValues.map(asRecord));
  const messageValues = Array.isArray(order.messages) ? order.messages : [];
  const messages = sortEvents(messageValues.flatMap((value) => {
    const message = asRecord(value);
    if (Object.keys(message).length) return [message];
    return typeof value === 'string' && value.trim() ? [{ message: value.trim() }] : [];
  }));
  const highlightValues = order.keypoints ?? order.keyPoints;
  const highlights = Array.isArray(highlightValues)
    ? highlightValues.flatMap((value) => {
        if (typeof value === 'string' && value.trim()) return [value.trim()];
        const highlight = asRecord(value);
        const label = text(highlight.title ?? highlight.text ?? highlight.message);
        return label ? [label] : [];
      })
    : [];
  const paymentMethod = paymentMethodLabel(
    paymentInfo.provider ?? payment.provider ?? order.payment_method ?? order.paymentMethod
  );
  const dueAmount = amount(order.amount_due ?? order.amountDue ?? order.dueAmount);
  const paidAmount = amount(order.amount_paid ?? order.amountPaid);
  const normalizedOrderStatus = normalizedStatus(status);
  const isEligibleForManualPayment =
    ['pending', 'processing'].includes(normalizedOrderStatus) &&
    dueAmount !== undefined &&
    dueAmount > 0 &&
    paidAmount === 0 &&
    !['paid', 'refunded'].includes(normalizedStatus(paymentStatus));
  const profileName = text(profile?.name ?? sessionUser?.name);
  const shopName = text(profile?.shopName ?? profile?.facebookPage);
  const shopLogo = text(profile?.shopLogo ?? profile?.image);
  const shopAddress = text(profile?.shopAddress);
  const shopWebsite = text(profile?.shopWebsite);
  const subtotalValue = subtotal ?? calculatedSubtotal;
  const codAmount = amount(order.codAmount ?? order.cod_amount);
  const invoiceItems = items.map((item) => {
    const product = nestedProduct(item);
    const quantity = amount(item.quantity);
    const price = linePrice(item, product);
    const total = amount(item.totalPrice ?? item.total_price) ??
      (price !== undefined && quantity !== undefined ? price * quantity : undefined);
    return {
      name: productName(item, product),
      variant: productVariant(item) || undefined,
      image: productImage(item, product) || undefined,
      quantity: quantity === undefined ? '—' : formatDropshippingNumber(quantity),
      sellingPrice: displayAmount(price),
      totalPrice: displayAmount(total),
    };
  });

  const downloadInvoice = async () => {
    setInvoiceError('');
    setIsDownloadingInvoice(true);
    try {
      const html = createDropshippingInvoiceHtml({
        orderId: idLabel,
        orderDate: date || 'তারিখ নেই',
        orderStatus: statusLabel(status),
        paymentStatus: statusLabel(paymentStatus),
        paymentMethod,
        customerName: customerName || 'তথ্য নেই',
        customerPhone: customerPhone || 'তথ্য নেই',
        customerAddress: addressLines.join(', ') || 'তথ্য নেই',
        subtotal: displayAmount(subtotalValue),
        deliveryCharge: displayAmount(deliveryCharge),
        total: displayAmount(totalSale),
        paid: displayAmount(paidAmount),
        codAmount: displayAmount(codAmount),
        courier: courier || undefined,
        trackingNumber: trackingNumber || undefined,
        trackingUrl: trackingUrl || undefined,
        shopName: shopName || 'তথ্য নেই',
        shopOwner: profileName || 'তথ্য নেই',
        shopAddress,
        shopWebsite: shopWebsite || undefined,
        shopLogo: shopLogo || undefined,
        items: invoiceItems,
      });
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('এই ডিভাইসে PDF শেয়ার করার সুবিধা পাওয়া যায়নি।');
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: '.pdf',
        dialogTitle: 'অর্ডার ইনভয়েস সংরক্ষণ বা শেয়ার করুন',
      });
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : 'ইনভয়েস তৈরি করা যায়নি।');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="অর্ডার তালিকায় ফিরুন"
          onPress={() => router.back()}
          className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-bg"
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
        </Pressable>
        <Text className="flex-1 text-[15px] font-extrabold text-ink">অর্ডারের বিস্তারিত</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="অর্ডারের তথ্য আবার লোড করুন"
          onPress={() => void orderQuery.refetch()}
          className="h-9 w-9 items-center justify-center rounded-full bg-primary-light"
        >
          {orderQuery.isRefetching
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh-outline" size={18} color={colors.primary} />}
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-3 rounded-2xl bg-primary p-4">
          <Text className="text-[9px] font-semibold text-white/75">অর্ডার নম্বর</Text>
          <Text selectable className="mt-1 text-[14px] font-extrabold text-white">{idLabel}</Text>
          <Text className="mt-2 text-[9px] text-white/80">{date || 'তারিখ নেই'}</Text>
          <View className="mt-3 flex-row">
            <View className="mr-2 flex-1 rounded-xl bg-white/15 px-3 py-2">
              <Text className="text-[8px] text-white/75">অর্ডারের অবস্থা</Text>
              <Text className="mt-1 text-[10px] font-bold text-white">{statusLabel(status)}</Text>
            </View>
            <View className="ml-2 flex-1 rounded-xl bg-white/15 px-3 py-2">
              <Text className="text-[8px] text-white/75">পেমেন্টের অবস্থা</Text>
              <Text className="mt-1 text-[10px] font-bold text-white">{statusLabel(paymentStatus)}</Text>
            </View>
          </View>
        </View>

        {isEligibleForManualPayment ? (
          <Section title="বকেয়া পেমেন্ট জমা দিন" icon="card-outline">
            <View className="mb-3 rounded-xl bg-primary-light px-3 py-3">
              <Text className="text-[9px] text-muted">বকেয়া পরিমাণ</Text>
              <Text className="mt-1 text-[18px] font-extrabold text-primary-dark">
                {displayAmount(dueAmount)}
              </Text>
              <Text className="mt-1 text-[9px] leading-4 text-muted">
                পেমেন্টের তথ্য যাচাই করে সার্ভার অর্ডারের অবস্থা আপডেট করবে।
              </Text>
            </View>
            <Text className="mb-2 text-[10px] font-bold text-ink">পেমেন্ট মাধ্যম</Text>
            <View className="mb-3 flex-row flex-wrap">
              {PAYMENT_PROVIDERS.map((provider) => {
                const selected = paymentProvider === provider.value;
                return (
                  <Pressable
                    key={provider.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setPaymentProvider(provider.value)}
                    className={`mb-2 mr-2 rounded-xl border px-3 py-2 ${selected ? 'border-primary bg-primary-light' : 'border-line bg-white'}`}
                  >
                    <Text className={`text-[10px] font-bold ${selected ? 'text-primary-dark' : 'text-muted'}`}>
                      {provider.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="mb-1.5 text-[10px] font-bold text-ink">যে নম্বর থেকে পাঠিয়েছেন</Text>
            <TextInput
              value={senderNumber}
              onChangeText={setSenderNumber}
              placeholder="মোবাইল নম্বর"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              className="mb-3 rounded-xl border border-line bg-bg px-3 py-3 text-[11px] text-ink"
            />
            <Text className="mb-1.5 text-[10px] font-bold text-ink">ট্রানজেকশন আইডি</Text>
            <TextInput
              value={transactionId}
              onChangeText={setTransactionId}
              placeholder="ট্রানজেকশন আইডি লিখুন"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              className="mb-3 rounded-xl border border-line bg-bg px-3 py-3 text-[11px] text-ink"
            />
            {paymentMutation.isError ? (
              <Text className="mb-3 text-[10px] leading-4 text-red-700">
                {paymentMutation.error instanceof Error
                  ? paymentMutation.error.message
                  : 'পেমেন্ট তথ্য জমা দেওয়া যায়নি।'}
              </Text>
            ) : null}
            {paymentNotice ? (
              <Text className="mb-3 text-[10px] leading-4 text-emerald-700">{paymentNotice}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={paymentMutation.isPending || !senderNumber.trim() || !transactionId.trim()}
              onPress={() => {
                setPaymentNotice('');
                paymentMutation.mutate();
              }}
              className={`flex-row items-center justify-center rounded-xl bg-primary px-4 py-3 ${paymentMutation.isPending || !senderNumber.trim() || !transactionId.trim() ? 'opacity-50' : ''}`}
            >
              {paymentMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send-outline" size={15} color="#FFFFFF" />
              )}
              <Text className="ml-2 text-[10px] font-bold text-white">
                {paymentMutation.isPending ? 'জমা হচ্ছে...' : 'পেমেন্টের তথ্য পাঠান'}
              </Text>
            </Pressable>
          </Section>
        ) : null}

        <Section title="ড্রপশিপার ও শপ" icon="storefront-outline">
          <View className="flex-row items-center">
            <View className="mr-3 h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary-light">
              {shopLogo ? (
                <Image
                  source={{ uri: shopLogo }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Ionicons name="storefront-outline" size={23} color={colors.primary} />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[12px] font-extrabold text-ink">{shopName || 'তথ্য নেই'}</Text>
              <Text className="mt-1 text-[10px] text-muted">{profileName || 'তথ্য নেই'}</Text>
              {shopAddress ? <Text className="mt-1 text-[9px] text-muted">{shopAddress}</Text> : null}
              {shopWebsite ? <Text className="mt-1 text-[9px] text-primary">{shopWebsite}</Text> : null}
            </View>
          </View>
          <View className="mt-3 border-t border-line pt-3">
            <Text className="text-[10px] font-bold text-primary">EasyShoppingMallBD</Text>
            <Text className="mt-1 text-[9px] text-muted">বিশ্বস্ত অনলাইন শপিং ও ড্রপশিপিং</Text>
          </View>
        </Section>

        <Section title="অর্ডারের পণ্য" icon="bag-handle-outline">
          {items.length ? items.map((item, index) => (
            <ItemCard key={text(item._id ?? item.id) || `${idLabel}-${index}`} item={item} index={index} />
          )) : (
            <Text className="text-[10px] leading-4 text-muted">পণ্যের তথ্য API থেকে পাওয়া যায়নি।</Text>
          )}
        </Section>

        <Section title="গ্রাহক ও ডেলিভারি ঠিকানা" icon="location-outline">
          <DetailRow label="গ্রাহকের নাম" value={customerName} />
          <DetailRow label="ফোন নম্বর" value={customerPhone} />
          <DetailRow label="ঠিকানা" value={addressLines.join(', ')} />
        </Section>

        <Section title="মূল্য ও লাভ" icon="wallet-outline">
          <DetailRow label="মোট বিক্রয়মূল্য" value={displayAmount(totalSale)} />
          <DetailRow label="পণ্যের ক্রয়মূল্য" value={displayAmount(totalProductCost)} />
          {deliveryCharge !== undefined ? <DetailRow label="ডেলিভারি চার্জ" value={displayAmount(deliveryCharge)} /> : null}
          {extraCharge !== undefined ? <DetailRow label="অন্যান্য চার্জ" value={displayAmount(extraCharge)} /> : null}
          {discount !== undefined ? <DetailRow label="ছাড়" value={displayAmount(discount)} /> : null}
          <View className="my-1 h-px bg-line" />
          <DetailRow label="মোট খরচ" value={displayAmount(
            totalProductCost === undefined
              ? undefined
              : totalProductCost + (deliveryCharge ?? 0) + (extraCharge ?? 0)
          )} />
          <DetailRow label="সম্ভাব্য লাভ" value={displayAmount(estimatedProfit)} strong />
          {finalProfit !== undefined ? <DetailRow label="চূড়ান্ত লাভ" value={displayAmount(finalProfit)} strong /> : null}
          {invoiceError ? (
            <Text className="mb-2 text-[10px] leading-4 text-red-700">{invoiceError}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isDownloadingInvoice}
            onPress={() => void downloadInvoice()}
            className={`mt-2 flex-row items-center justify-center rounded-xl border border-primary px-4 py-3 ${isDownloadingInvoice ? 'opacity-60' : ''}`}
          >
            {isDownloadingInvoice ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={16} color={colors.primary} />
            )}
            <Text className="ml-2 text-[10px] font-bold text-primary">
              {isDownloadingInvoice ? 'ইনভয়েস তৈরি হচ্ছে...' : 'ইনভয়েস ডাউনলোড করুন'}
            </Text>
          </Pressable>
        </Section>

        <Section title="পেমেন্টের তথ্য" icon="card-outline">
          <DetailRow label="পেমেন্ট মাধ্যম" value={paymentMethod} />
          <DetailRow label="পেমেন্টের অবস্থা" value={statusLabel(paymentStatus)} />
          <DetailRow label="পরিশোধিত পরিমাণ" value={displayAmount(paidAmount)} />
          <DetailRow label="ক্যাশ অন ডেলিভারি" value={displayAmount(codAmount)} />
          {text(order.payment_type) ? <DetailRow label="পেমেন্টের ধরন" value={text(order.payment_type) === 'full' ? 'সম্পূর্ণ পেমেন্ট' : text(order.payment_type) === 'delivery' ? 'ডেলিভারি চার্জ' : 'তথ্য নেই'} /> : null}
          {text(paymentInfo.provider) ? <DetailRow label="সেবা প্রদানকারী" value={paymentMethodLabel(paymentInfo.provider)} /> : null}
        </Section>

        <Section title="গুরুত্বপূর্ণ তথ্য" icon="sparkles-outline">
          {highlights.length ? (
            highlights.map((highlight, index) => (
              <View key={`${highlight}-${index}`} className="mb-2 flex-row items-start">
                <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
                <Text className="ml-2 flex-1 text-[10px] leading-4 text-ink">{highlight}</Text>
              </View>
            ))
          ) : (
            <Text className="text-[10px] leading-4 text-muted">
              এই অর্ডারের জন্য কোনো গুরুত্বপূর্ণ তথ্য API-তে নেই।
            </Text>
          )}
        </Section>

        <Section title="স্ট্যাটাস হিস্ট্রি" icon="time-outline">
          {timeline.length ? timeline.map((event, index) => {
            const oldStatus = text(event.fromStatus ?? event.previousStatus ?? event.oldStatus);
            const newStatus = event.toStatus ?? event.newStatus ?? event.status ?? event.order_status;
            const messageText = text(event.message ?? event.text ?? event.content ?? event.note);
            const createdAt = dateLabel(
              event.createdAt ?? event.created_at ?? event.updatedAt ?? event.date ?? event.timestamp
            );
            return (
            <View key={text(event._id ?? event.id) || `status-${index}`} className="flex-row">
              <View className="mr-3 items-center">
                <View className={`h-3 w-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-emerald-500'}`} />
                {index < timeline.length - 1 ? <View className="my-1 h-8 w-px bg-line" /> : null}
              </View>
              <View className="flex-1 pb-3">
                <Text className="text-[10px] font-bold text-ink">
                  {oldStatus
                    ? `${statusLabel(event.fromStatus ?? event.previousStatus)} → `
                    : ''}
                  {statusLabel(newStatus)}
                </Text>
                {createdAt ? (
                  <Text className="mt-1 text-[9px] text-muted">
                    {createdAt}
                  </Text>
                ) : null}
                {text(event.changedByName ?? event.actorName ?? event.role) ? (
                  <Text className="mt-1 text-[9px] text-muted">
                    {text(event.changedByName ?? event.actorName ?? event.role)}
                  </Text>
                ) : null}
                {messageText ? (
                  <Text className="mt-1 text-[9px] leading-4 text-muted">{messageText}</Text>
                ) : null}
              </View>
            </View>
          )}) : null}
          {!timeline.length ? (
            <Text className="text-[10px] leading-4 text-muted">
              এই অর্ডারের স্ট্যাটাস হিস্ট্রি API থেকে পাওয়া যায়নি।
            </Text>
          ) : null}
        </Section>

        <Section title="অর্ডার আপডেট ও বার্তা" icon="chatbubbles-outline">
          {messages.length ? messages.map((message, index) => {
            const messageText = text(message.message ?? message.text ?? message.content ?? message.note);
            const sender = text(
              message.senderName ?? message.sender ?? message.userName ?? message.actorName ?? message.role
            );
            const createdAt = dateLabel(
              message.createdAt ?? message.created_at ?? message.updatedAt ?? message.date ?? message.timestamp
            );
            return (
              <View
                key={text(message._id ?? message.id) || `message-${index}`}
                className={`py-3 ${index ? 'border-t border-line' : ''}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="mr-2 flex-1 text-[10px] font-bold text-ink">
                    {sender || 'বার্তা'}
                  </Text>
                  {createdAt ? <Text className="text-[9px] text-muted">{createdAt}</Text> : null}
                </View>
                {messageText ? (
                  <Text className="mt-2 text-[10px] leading-4 text-muted">{messageText}</Text>
                ) : null}
              </View>
            );
          }) : (
            <Text className="text-[10px] leading-4 text-muted">
              এই অর্ডারের কোনো বার্তা API থেকে পাওয়া যায়নি।
            </Text>
          )}
        </Section>

        {courier || trackingNumber || trackingUrl ? (
          <Section title="ট্র্যাকিং তথ্য" icon="navigate-outline">
            {courier ? <DetailRow label="কুরিয়ার / শিপিং প্রদানকারী" value={courier} /> : null}
            {trackingNumber ? <DetailRow label="ট্র্যাকিং নম্বর" value={trackingNumber} /> : null}
            {trackingUrl ? <DetailRow label="ট্র্যাকিং লিংক" value={trackingUrl} /> : null}
          </Section>
        ) : null}

        {notes ? (
          <Section title="অর্ডার নোট" icon="document-text-outline">
            <Text className="text-[10px] leading-5 text-ink">{notes}</Text>
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
