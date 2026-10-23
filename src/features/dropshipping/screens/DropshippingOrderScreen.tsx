import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../../store/hooks';
import bdLocations from '../../../data/bd-dd-ui-bn';
import { colors } from '../../../shared/theme/colors';
import {
  formatDropshippingNumber,
  formatDropshippingTaka,
} from '../api/homeApi';
import {
  applyDropshippingCoupon,
  createDropshippingOrder,
  submitDropshippingManualPayment,
  type CreateDropshippingOrderPayload,
  type DropshippingCouponResult,
  type DropshippingOrderResult,
  type DropshippingPaymentProvider,
  type DropshippingPaymentType,
} from '../api/ordersApi';
import type { DropshippingProduct } from '../api/homeApi';
import {
  useDropshippingProductDetailsQuery,
  useSearchDropshippingProductsQuery,
} from '../api/queries';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-[11px] font-semibold text-ink">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        className="rounded-xl border border-line bg-bg px-3.5 py-3 text-[13px] text-ink"
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

function ChoiceRow({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: string[];
  value: string;
  onSelect: (option: string) => void;
}) {
  if (!options.length) return null;
  return (
    <View className="mb-4">
      <Text className="mb-2 text-[12px] font-bold text-ink">{label}</Text>
      <View className="flex-row flex-wrap">
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: value === option }}
            onPress={() => onSelect(option)}
            className={`mb-2 mr-2 rounded-xl border px-3.5 py-2.5 ${value === option ? 'border-primary bg-primary-light' : 'border-line bg-white'}`}
          >
            <Text className={`text-[11px] font-semibold ${value === option ? 'text-primary-dark' : 'text-ink'}`}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

interface BangladeshDistrict {
  district: string;
  upazilas: string[];
}

interface BangladeshDivision {
  division: string;
  districts: BangladeshDistrict[];
}

type LocationField = 'division' | 'district' | 'upazila';
const bangladeshLocations = bdLocations as BangladeshDivision[];

interface DropshippingOrderItem {
  product: DropshippingProduct;
  quantity: string;
  size: string;
  color: string;
  weight: string;
}

export function DropshippingOrderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderSubmitInProgress = useRef(false);
  const params = useLocalSearchParams<{
    id?: string | string[];
    size?: string | string[];
    color?: string | string[];
    weight?: string | string[];
  }>();
  const productId = firstParam(params.id);
  const productQuery = useDropshippingProductDetailsQuery(productId);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const searchProductsQuery = useSearchDropshippingProductsQuery(productSearch, 1);
  const user = useAppSelector((state) => state.auth.user);
  const product = productQuery.data;
  const [customerName, setCustomerName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState('');
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [postCode, setPostCode] = useState('');
  const [locationPicker, setLocationPicker] = useState<LocationField | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [orderItemsState, setOrderItemsState] = useState<DropshippingOrderItem[] | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<DropshippingPaymentProvider>('bkash');
  const [paymentType, setPaymentType] = useState<DropshippingPaymentType>('delivery');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    cartKey: string;
    result: DropshippingCouponResult;
  }>();
  const [orderResult, setOrderResult] = useState<DropshippingOrderResult>();
  const [paymentRetryError, setPaymentRetryError] = useState('');

  const initialOrderItems: DropshippingOrderItem[] = product
    ? [{
          product,
          quantity: '1',
          size: firstParam(params.size) || product.sizes?.[0] || '',
          color: firstParam(params.color) || product.colors?.[0] || '',
          weight: firstParam(params.weight) || product.weights?.[0] || '',
        }]
    : [];
  const orderItems = orderItemsState ?? initialOrderItems;
  const setOrderItems = (update: (current: DropshippingOrderItem[]) => DropshippingOrderItem[]) => {
    setOrderItemsState((current) => update(current ?? initialOrderItems));
  };

  const orderCartKey = orderItems
    .map((item) => `${item.product.id}:${item.quantity}:${item.product.dropshippingPrice ?? ''}`)
    .sort()
    .join('|');
  const validOrderItems = orderItems.flatMap((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) return [];
    const productCost = item.product.dropshippingPrice;
    const cost = typeof productCost === 'number' && Number.isFinite(productCost) && productCost > 0
      ? productCost
      : undefined;
    return [{ ...item, parsedQuantity: quantity, cost }];
  });
  const quantityIsValid = validOrderItems.length === orderItems.length && orderItems.length > 0;
  const hasUnknownCost = validOrderItems.some((item) => item.cost === undefined);
  const subtotal = hasUnknownCost
    ? undefined
    : validOrderItems.reduce((total, item) => {
        if (item.cost === undefined) return total;
        return total + item.cost * item.parsedQuantity;
      }, 0);
  const allSuggestedPricesAvailable = validOrderItems.length === orderItems.length &&
    validOrderItems.length > 0 &&
    validOrderItems.every((item) => item.product.productRank !== undefined);
  const suggestedSalesTotal = validOrderItems.reduce(
    (total, item) => total + (item.product.productRank ?? 0) * item.parsedQuantity,
    0
  );
  const estimatedProfit = allSuggestedPricesAvailable && !hasUnknownCost
    ? validOrderItems.reduce(
        (total, item) => item.cost === undefined || item.product.productRank === undefined
          ? total
          : total + (item.product.productRank - item.cost) * item.parsedQuantity,
        0,
      )
    : undefined;
  const estimateDeliveryCharge = ['ঢাকা', 'dhaka'].includes(district.trim().toLocaleLowerCase())
    ? 80
    : 130;
  const activeCoupon = !hasUnknownCost &&
    appliedCoupon &&
    appliedCoupon.code.toLocaleLowerCase() === couponCode.trim().toLocaleLowerCase() &&
    appliedCoupon.cartKey === orderCartKey
      ? appliedCoupon
      : undefined;
  const couponDiscount = Math.min(activeCoupon?.result.discountAmount ?? 0, subtotal ?? 0);
  const totalEstimate = subtotal === undefined
    ? undefined
    : Math.max(0, subtotal + estimateDeliveryCharge - couponDiscount);
  const locationOptions = useMemo(() => {
    if (locationPicker === 'division') {
      return bangladeshLocations.map((location) => location.division);
    }
    if (locationPicker === 'district') {
      return bangladeshLocations
        .find((location) => location.division === division)
        ?.districts.map((location) => location.district) ?? [];
    }
    if (locationPicker === 'upazila') {
      return bangladeshLocations
        .find((location) => location.division === division)
        ?.districts.find((location) => location.district === district)
        ?.upazilas ?? [];
    }
    return [];
  }, [district, division, locationPicker]);
  const filteredLocationOptions = useMemo(() => {
    const query = locationSearch.trim();
    return query
      ? locationOptions.filter((option) => option.includes(query))
      : locationOptions;
  }, [locationOptions, locationSearch]);

  const orderMutation = useMutation({
    mutationFn: (payload: CreateDropshippingOrderPayload) => createDropshippingOrder(payload),
    onSuccess: async (result) => {
      setOrderResult(result);
      await queryClient.invalidateQueries({ queryKey: ['customer', 'orders', user?._id] });
    },
    onError: (error) => {
      Alert.alert(
        'অর্ডার করা যায়নি',
        error instanceof Error ? error.message : 'আবার চেষ্টা করুন।'
      );
    },
    onSettled: () => {
      orderSubmitInProgress.current = false;
    },
  });

  const couponMutation = useMutation({
    mutationFn: ({ code, cartItems, cartKey }: {
      code: string;
      cartItems: { productId: string; quantity: number; price: number }[];
      cartKey: string;
    }) => applyDropshippingCoupon(code, cartItems),
    onSuccess: (result, variables) => {
      setAppliedCoupon({
        code: variables.code,
        cartKey: variables.cartKey,
        result,
      });
    },
  });

  const paymentRetryMutation = useMutation({
    mutationFn: () =>
      submitDropshippingManualPayment(
        orderResult!.orderId,
        paymentProvider,
        paymentNumber.trim(),
        transactionId.trim()
      ),
    onSuccess: () => {
      setPaymentRetryError('');
      setOrderResult((current) => current ? { ...current, paymentWarning: undefined } : current);
    },
    onError: (error) => {
      setPaymentRetryError(error instanceof Error ? error.message : 'পেমেন্ট তথ্য জমা হয়নি।');
    },
  });

  const placeOrder = () => {
    if (orderSubmitInProgress.current) return;
    if (!user?._id) {
      Alert.alert('লগইন প্রয়োজন', 'অর্ডার করার আগে আপনার অ্যাকাউন্টে লগইন করুন।');
      return;
    }
    if (!orderItems.length) {
      Alert.alert('পণ্য যোগ করুন', 'অর্ডার করতে অন্তত একটি পণ্য যোগ করুন।');
      return;
    }
    const outOfStockItem = orderItems.find((item) =>
      item.product.stockCount !== undefined && item.product.stockCount <= 0
    );
    if (outOfStockItem) {
      Alert.alert('স্টক নেই', `${outOfStockItem.product.name} বর্তমানে স্টকে নেই।`);
      return;
    }
    if (!customerName.trim() || !address.trim() || !division.trim() || !district.trim() || !upazila.trim()) {
      Alert.alert('ঠিকানা অসম্পূর্ণ', 'নাম, ঠিকানা, বিভাগ, জেলা ও উপজেলা পূরণ করুন।');
      return;
    }
    if (!/^\d{10,14}$/.test(phone.trim())) {
      Alert.alert('মোবাইল নম্বর যাচাই করুন', '১০–১৪ সংখ্যার সঠিক মোবাইল নম্বর লিখুন।');
      return;
    }
    const invalidQuantityItem = orderItems.find((item) => {
      const quantity = Number(item.quantity);
      return !Number.isInteger(quantity) || quantity < 1;
    });
    if (invalidQuantityItem) {
      Alert.alert('পরিমাণ যাচাই করুন', `${invalidQuantityItem.product.name}-এর সঠিক পরিমাণ লিখুন।`);
      return;
    }
    const exceedsStockItem = orderItems.find((item) => {
      const quantity = Number(item.quantity);
      return item.product.stockCount !== undefined && quantity > item.product.stockCount;
    });
    if (exceedsStockItem) {
      Alert.alert(
        'স্টকের বেশি পরিমাণ',
        `${exceedsStockItem.product.name}-এর সর্বোচ্চ ${formatDropshippingNumber(exceedsStockItem.product.stockCount ?? 0)}টি অর্ডার করতে পারবেন।`
      );
      return;
    }
    const missingVariant = orderItems.find((item) =>
      (item.product.sizes?.length && !item.size) ||
      (item.product.colors?.length && !item.color) ||
      (item.product.weights?.length && !item.weight)
    );
    if (missingVariant) {
      Alert.alert('ভ্যারিয়েন্ট বাছুন', `${missingVariant.product.name}-এর সাইজ, রং বা ওজন নির্বাচন করুন।`);
      return;
    }
    if (!/^\d{10,14}$/.test(paymentNumber.trim()) || !transactionId.trim()) {
      Alert.alert('পেমেন্ট তথ্য যাচাই করুন', '১০–১৪ সংখ্যার পেমেন্ট নম্বর ও ট্রানজ্যাকশন আইডি দিন।');
      return;
    }

    const orderProducts = validOrderItems.flatMap((item) => {
      const sellingPrice = item.product.productRank ?? item.cost;
      if (sellingPrice === undefined || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
        return [];
      }
      return [{
        productId: item.product.id,
        quantity: item.parsedQuantity,
        sellingPrice,
        ...(item.size ? { size: item.size } : {}),
        ...(item.color ? { color: item.color } : {}),
        ...(item.weight ? { weight: item.weight } : {}),
      }];
    });
    if (orderProducts.length !== validOrderItems.length) {
      const itemWithoutSellingPrice = validOrderItems.find((item) =>
        item.product.productRank === undefined && item.cost === undefined
      );
      Alert.alert(
        'বিক্রয়মূল্য পাওয়া যায়নি',
        `${itemWithoutSellingPrice?.product.name ?? 'একটি পণ্যের'} জন্য বিক্রয়মূল্য পাওয়া যায়নি।`
      );
      return;
    }

    const digits = phone.trim();
    const payload: CreateDropshippingOrderPayload = {
      products: orderProducts,
      delivery_address: {
        customer_name: customerName.trim(),
        address_line: address.trim(),
        district: district.trim(),
        division: division.trim(),
        upazila_thana: upazila.trim(),
        pincode: postCode.trim(),
        country: 'Bangladesh',
        mobile: Number(digits),
      },
      payment_method: 'manual',
      payment_type: paymentType,
      payment_details: {
        transactionId: transactionId.trim(),
        manual: {
          provider: paymentProvider,
          senderNumber: paymentNumber.trim(),
          transactionId: transactionId.trim(),
        },
      },
      ...(activeCoupon ? { appliedCoupon: activeCoupon.code } : {}),
    };
    orderSubmitInProgress.current = true;
    orderMutation.mutate(payload);
  };

  const openVideo = async () => {
    if (!product?.videoUrl) return;
    try {
      await Linking.openURL(product.videoUrl);
    } catch {
      Alert.alert('ভিডিও খোলা যায়নি', 'ভিডিও লিংকটি পরে আবার চেষ্টা করুন।');
    }
  };

  if (!productId) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg px-6">
        <Ionicons name="alert-circle-outline" size={38} color={colors.accent} />
        <Text className="mt-3 text-center text-[14px] font-bold text-ink">
          অর্ডারের পণ্যের আইডি পাওয়া যায়নি।
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-xl bg-primary px-5 py-3">
          <Text className="text-[11px] font-bold text-white">ফিরে যান</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (productQuery.isPending) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-3 text-[12px] text-muted">অর্ডারের তথ্য লোড হচ্ছে...</Text>
      </SafeAreaView>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg px-6">
        <Ionicons name="alert-circle-outline" size={38} color={colors.accent} />
        <Text className="mt-3 text-center text-[14px] font-bold text-ink">
          {productQuery.error?.message || 'পণ্যের তথ্য পাওয়া যায়নি।'}
        </Text>
        <Pressable onPress={() => void productQuery.refetch()} className="mt-4 rounded-xl bg-primary px-5 py-3">
          <Text className="text-[11px] font-bold text-white">আবার চেষ্টা করুন</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line">
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Text className="flex-1 text-[15px] font-extrabold text-ink">ড্রপশিপিং অর্ডার</Text>
        {product.videoUrl ? (
          <Pressable accessibilityLabel="পণ্যের ভিডিও খুলুন" onPress={() => void openVideo()} className="h-10 w-10 items-center justify-center rounded-full bg-primary-light">
            <Ionicons name="videocam" size={20} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {orderResult ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View className="rounded-[24px] border border-line bg-white p-6">
            <View className="h-16 w-16 items-center justify-center self-center rounded-full bg-primary-light">
              <Ionicons name="checkmark-circle" size={38} color={colors.primary} />
            </View>
            <Text className="mt-4 text-center text-[19px] font-extrabold text-ink">অর্ডার গ্রহণ করা হয়েছে</Text>
            <Text className="mt-2 text-center text-[12px] text-muted">অর্ডার নম্বর: {orderResult.orderId}</Text>
            {orderResult.orderTotal !== undefined ? (
              <Text className="mt-2 text-center text-[13px] font-bold text-primary">
                সার্ভার-নিশ্চিত মোট: {formatDropshippingTaka(orderResult.orderTotal)}
              </Text>
            ) : null}
            <View className="mt-5 rounded-2xl bg-bg p-4">
              <Text className="mb-2 text-[12px] font-extrabold text-ink">
                গ্রাহকের অর্ডার · {formatDropshippingNumber(orderItems.length)}টি পণ্য
              </Text>
              {orderItems.map((item) => {
                const quantity = Number(item.quantity);
                const itemCost = (item.product.dropshippingPrice ?? 0) * quantity;
                const itemSales = (item.product.productRank ?? 0) * quantity;
                return (
                  <View key={item.product.id} className="mb-2 border-b border-line pb-2">
                    <Text className="text-[11px] font-semibold text-ink">
                      {item.product.name} × {formatDropshippingNumber(quantity)}
                    </Text>
                    <Text className="mt-1 text-[10px] text-muted">
                      খরচ {formatDropshippingTaka(itemCost)} · প্রস্তাবিত বিক্রি {item.product.productRank === undefined
                        ? 'তথ্য নেই'
                        : formatDropshippingTaka(itemSales)}
                    </Text>
                  </View>
                );
              })}
              <Text className="mt-1 text-[11px] text-muted">গ্রাহক: {customerName} · {phone}</Text>
              <Text className="mt-1 text-[11px] text-muted">
                ঠিকানা: {address}, {upazila}, {district}, {division}
              </Text>
              {activeCoupon ? (
                <Text className="mt-1 text-[11px] text-emerald-700">
                  কুপন: {activeCoupon.code} · ছাড় {formatDropshippingTaka(couponDiscount)}
                </Text>
              ) : null}
              {estimatedProfit !== undefined ? (
                <Text className="mt-1 text-[11px] font-semibold text-emerald-700">
                  আনুমানিক মোট পণ্য-মার্জিন: {formatDropshippingTaka(estimatedProfit)} (কুপনের আগে)
                </Text>
              ) : null}
            </View>
            {orderResult.paymentWarning || paymentRetryError ? (
              <View className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <Text className="text-[12px] font-semibold text-amber-900">
                  {paymentRetryError || orderResult.paymentWarning}
                </Text>
                <Pressable
                  disabled={paymentRetryMutation.isPending}
                  onPress={() => paymentRetryMutation.mutate()}
                  className="mt-3 self-start rounded-lg bg-amber-700 px-3 py-2"
                >
                  {paymentRetryMutation.isPending
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text className="text-[11px] font-bold text-white">পেমেন্ট তথ্য আবার পাঠান</Text>}
                </Pressable>
              </View>
            ) : (
              <Text className="mt-3 text-center text-[12px] text-primary">পেমেন্ট তথ্য জমা হয়েছে।</Text>
            )}
            <Pressable onPress={() => router.replace('/(dropshipping)/all-products')} className="mt-6 items-center rounded-xl bg-primary py-3.5">
              <Text className="text-[12px] font-bold text-white">আরও পণ্য দেখুন</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 }}
          >
            <View className="w-full max-w-[760px]">
              <View className="rounded-[22px] border border-line bg-white p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <View>
                    <Text className="text-[14px] font-extrabold text-ink">অর্ডারের পণ্য</Text>
                    <Text className="mt-1 text-[10px] text-muted">
                      {formatDropshippingNumber(orderItems.length)}টি পণ্য · পরিমাণ অনুযায়ী হিসাব
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setProductSearch('');
                      setShowProductPicker(true);
                    }}
                    className="min-h-10 flex-row items-center rounded-xl bg-primary px-3"
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text className="ml-1 text-[11px] font-bold text-white">পণ্য যোগ</Text>
                  </Pressable>
                </View>
                {orderItems.map((item) => {
                  const unitCost = item.product.dropshippingPrice;
                  const parsedItemQuantity = Number(item.quantity);
                  const quantityError = !Number.isInteger(parsedItemQuantity) || parsedItemQuantity < 1
                    ? 'কমপক্ষে ১টি পূর্ণ সংখ্যা লিখুন।'
                    : item.product.stockCount !== undefined && parsedItemQuantity > item.product.stockCount
                      ? `স্টকে সর্বোচ্চ ${formatDropshippingNumber(item.product.stockCount)}টি আছে।`
                      : undefined;
                  const itemProfit = item.product.productRank !== undefined && unitCost !== undefined
                    ? (item.product.productRank - unitCost) * (Number.isInteger(parsedItemQuantity) ? parsedItemQuantity : 0)
                    : undefined;
                  const updateItem = (changes: Partial<DropshippingOrderItem>) => {
                    setOrderItems((current) => current.map((currentItem) =>
                      currentItem.product.id === item.product.id
                        ? { ...currentItem, ...changes }
                        : currentItem
                    ));
                    couponMutation.reset();
                  };
                  return (
                    <View key={item.product.id} className="mb-3 rounded-2xl border border-line bg-bg p-3">
                      <View className="flex-row">
                        <Image
                          source={{ uri: item.product.images?.[0] ?? item.product.image }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={item.product.id}
                          style={{ width: 68, height: 68, borderRadius: 10, backgroundColor: '#F3F4F6' }}
                        />
                        <View className="ml-3 flex-1 justify-center">
                          <Text numberOfLines={2} className="text-[12px] font-bold text-ink">
                            {item.product.name}
                          </Text>
                          <Text className="mt-1 text-[10px] text-muted">
                            পণ্য খরচ: {unitCost === undefined ? 'তথ্য নেই' : formatDropshippingTaka(unitCost)}
                          </Text>
                          <Text className="text-[10px] text-muted">
                            প্রস্তাবিত বিক্রি: {item.product.productRank === undefined
                              ? 'তথ্য নেই'
                              : formatDropshippingTaka(item.product.productRank)}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${item.product.name} সরান`}
                          onPress={() => {
                            setOrderItems((current) => current.filter(
                              (currentItem) => currentItem.product.id !== item.product.id
                            ));
                            couponMutation.reset();
                          }}
                          className="h-9 w-9 items-center justify-center rounded-full bg-white"
                        >
                          <Ionicons name="trash-outline" size={17} color={colors.accent} />
                        </Pressable>
                      </View>
                      <View className="mt-3 flex-row items-end">
                        <View className="mr-3 flex-1">
                          <FormField
                            label="পরিমাণ"
                            value={item.quantity}
                            onChangeText={(value) => updateItem({ quantity: value })}
                            placeholder="১"
                            keyboardType="number-pad"
                          />
                        </View>
                        <View className="mb-3 flex-1">
                          <Text className="mb-1.5 text-[11px] font-semibold text-ink">মোট পণ্য খরচ</Text>
                          <Text className="rounded-xl border border-line bg-white px-3.5 py-3 text-[13px] font-bold text-ink">
                            {unitCost === undefined || !Number.isInteger(parsedItemQuantity) || parsedItemQuantity < 1
                              ? '—'
                              : formatDropshippingTaka(unitCost * parsedItemQuantity)}
                          </Text>
                        </View>
                      </View>
                      {quantityError ? (
                        <Text className="mb-2 text-[10px] font-semibold text-red-600">{quantityError}</Text>
                      ) : null}
                      <ChoiceRow
                        label="সাইজ"
                        options={item.product.sizes ?? []}
                        value={item.size}
                        onSelect={(value) => updateItem({ size: value })}
                      />
                      <ChoiceRow
                        label="রং"
                        options={item.product.colors ?? []}
                        value={item.color}
                        onSelect={(value) => updateItem({ color: value })}
                      />
                      <ChoiceRow
                        label="ওজন"
                        options={item.product.weights ?? []}
                        value={item.weight}
                        onSelect={(value) => updateItem({ weight: value })}
                      />
                      {item.product.stockCount !== undefined ? (
                        <Text className={`text-[10px] ${item.product.stockCount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {item.product.stockCount > 0
                            ? `স্টকে ${formatDropshippingNumber(item.product.stockCount)}টি`
                            : 'স্টক নেই'}
                        </Text>
                      ) : null}
                      {itemProfit !== undefined ? (
                        <Text className={`mt-1 text-[10px] font-bold ${itemProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          আনুমানিক পণ্য লাভ: {formatDropshippingTaka(itemProfit)}
                        </Text>
                      ) : (
                        <Text className="mt-1 text-[10px] text-amber-700">
                          বিক্রয়মূল্য/লাভের তথ্য API-তে নেই
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">ডেলিভারি ঠিকানা</Text>
                <FormField label="গ্রাহকের নাম" value={customerName} onChangeText={setCustomerName} placeholder="সম্পূর্ণ নাম" />
                <FormField label="মোবাইল নম্বর" value={phone} onChangeText={setPhone} placeholder="01XXXXXXXXX" keyboardType="phone-pad" />
                <FormField label="বাড়ি / রাস্তা / এলাকার ঠিকানা" value={address} onChangeText={setAddress} placeholder="বিস্তারিত ঠিকানা" />
                {([
                  ['division', 'বিভাগ', division, false],
                  ['district', 'জেলা', district, !division],
                  ['upazila', 'উপজেলা / থানা', upazila, !district],
                ] as const).map(([field, label, value, disabled]) => (
                  <View key={field} className="mb-3">
                    <Text className="mb-1.5 text-[11px] font-semibold text-ink">{label}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${label} নির্বাচন করুন`}
                      disabled={disabled}
                      onPress={() => {
                        setLocationSearch('');
                        setLocationPicker(field);
                      }}
                      className={`flex-row items-center justify-between rounded-xl border border-line px-3.5 py-3 ${disabled ? 'bg-line/40' : 'bg-bg'}`}
                    >
                      <Text className={`text-[13px] ${value ? 'text-ink' : 'text-muted'}`}>
                        {value || `${label} নির্বাচন করুন`}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
                <FormField label="পোস্ট কোড (ঐচ্ছিক)" value={postCode} onChangeText={setPostCode} placeholder="পোস্ট কোড" keyboardType="number-pad" />
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-2 text-[14px] font-extrabold text-ink">কুপন কোড</Text>
                <View className="flex-row items-center">
                  <TextInput
                    value={couponCode}
                    onChangeText={(value) => {
                      setCouponCode(value);
                      couponMutation.reset();
                    }}
                    placeholder="কুপন কোড লিখুন"
                    autoCapitalize="characters"
                    placeholderTextColor={colors.muted}
                    className="mr-2 min-h-11 flex-1 rounded-xl border border-line bg-bg px-3 text-[12px] text-ink"
                  />
                  {activeCoupon ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setCouponCode('');
                        setAppliedCoupon(undefined);
                        couponMutation.reset();
                      }}
                      className="min-h-11 items-center justify-center rounded-xl border border-line px-4"
                    >
                      <Text className="text-[11px] font-bold text-ink">সরান</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={
                        couponMutation.isPending ||
                        !couponCode.trim() ||
                        !quantityIsValid ||
                        hasUnknownCost
                      }
                      onPress={() => {
                        const cartItems = validOrderItems.flatMap((item) =>
                          item.cost === undefined
                            ? []
                            : [{
                                productId: item.product.id,
                                quantity: item.parsedQuantity,
                                price: item.cost,
                              }]
                        );
                        if (cartItems.length !== validOrderItems.length) return;
                        couponMutation.mutate({
                          code: couponCode.trim(),
                          cartKey: orderCartKey,
                          cartItems,
                        });
                      }}
                      className={`min-h-11 min-w-20 items-center justify-center rounded-xl px-4 ${couponMutation.isPending || !couponCode.trim() || !quantityIsValid || hasUnknownCost ? 'bg-primary/50' : 'bg-primary'}`}
                    >
                      {couponMutation.isPending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text className="text-[11px] font-bold text-white">প্রয়োগ</Text>
                      )}
                    </Pressable>
                  )}
                </View>
                {couponMutation.isError ? (
                  <Text className="mt-2 text-[10px] text-red-600">
                    {couponMutation.error.message || 'কুপনটি প্রয়োগ করা যায়নি।'}
                  </Text>
                ) : null}
                {activeCoupon ? (
                  <Text className="mt-2 text-[10px] font-semibold text-emerald-700">
                    কুপন প্রয়োগ হয়েছে · ছাড় {formatDropshippingTaka(couponDiscount)}
                  </Text>
                ) : null}
                {hasUnknownCost ? (
                  <Text className="mt-2 text-[10px] leading-4 text-amber-700">
                    কিছু পণ্যের dropshipping খরচ API-তে নেই। তাই মোট খরচ, লাভ ও কুপন হিসাব দেখানো যাচ্ছে না; অনুমান করে কোনো মূল্য ব্যবহার করা হবে না।
                  </Text>
                ) : null}
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">পেমেন্ট তথ্য</Text>
                <View className="mb-1 flex-row flex-wrap justify-between">
                  {([
                    ['bkash', 'বিকাশ'],
                    ['nagad', 'নগদ'],
                    ['rocket', 'রকেট'],
                    ['upay', 'উপায়'],
                  ] as const).map(([provider, label]) => (
                    <Pressable
                      key={provider}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: paymentProvider === provider }}
                      onPress={() => setPaymentProvider(provider)}
                      className={`mb-2 w-[48%] flex-row items-center justify-center rounded-xl border py-3 ${paymentProvider === provider ? 'border-primary bg-primary-light' : 'border-line bg-bg'}`}
                    >
                      <Ionicons name={paymentProvider === provider ? 'radio-button-on' : 'radio-button-off'} size={17} color={paymentProvider === provider ? colors.primary : colors.muted} />
                      <Text className="ml-2 text-[12px] font-semibold text-ink">{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="mb-2 text-[10px] leading-4 text-muted">
                  এই API-তে bKash, Nagad, Rocket ও Upay manual payment সমর্থিত। Cash on Delivery এখনকার order API-তে নেই।
                </Text>
                <FormField label="যে নম্বর থেকে পেমেন্ট করেছেন" value={paymentNumber} onChangeText={setPaymentNumber} placeholder="01XXXXXXXXX" keyboardType="phone-pad" />
                <FormField label="ট্রানজ্যাকশন আইডি" value={transactionId} onChangeText={setTransactionId} placeholder="TrxID" autoCapitalize="characters" />
                <Text className="mb-2 text-[12px] font-bold text-ink">কত টাকা পেমেন্ট করেছেন?</Text>
                <View className="flex-row">
                  {([
                    ['delivery', 'শুধু ডেলিভারি চার্জ'],
                    ['full', 'সম্পূর্ণ টাকা'],
                  ] as const).map(([type, label]) => (
                    <Pressable
                      key={type}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: paymentType === type }}
                      onPress={() => setPaymentType(type)}
                      className={`mr-2 flex-1 rounded-xl border p-3 ${paymentType === type ? 'border-primary bg-primary-light' : 'border-line bg-bg'}`}
                    >
                      <Text className={`text-center text-[10px] font-semibold ${paymentType === type ? 'text-primary-dark' : 'text-ink'}`}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">অর্ডারের হিসাব</Text>
                {allSuggestedPricesAvailable ? (
                  <View className="mb-2 flex-row justify-between">
                    <Text className="text-[12px] text-muted">প্রস্তাবিত বিক্রয়মূল্য মোট</Text>
                    <Text className="text-[12px] font-semibold text-ink">{formatDropshippingTaka(suggestedSalesTotal)}</Text>
                  </View>
                ) : null}
                <View className="mb-2 flex-row justify-between">
                  <Text className="text-[12px] text-muted">পণ্য খরচ মোট</Text>
                  <Text className="text-[12px] font-semibold text-ink">
                    {subtotal === undefined ? 'তথ্য নেই' : formatDropshippingTaka(subtotal)}
                  </Text>
                </View>
                {estimatedProfit !== undefined ? (
                  <View className="mb-2 flex-row justify-between">
                    <Text className="text-[12px] text-muted">আনুমানিক মোট পণ্য লাভ</Text>
                    <Text className={`text-[12px] font-bold ${estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatDropshippingTaka(estimatedProfit)}
                    </Text>
                  </View>
                ) : null}
                {activeCoupon ? (
                  <View className="mb-2 flex-row justify-between">
                    <Text className="text-[12px] text-muted">কুপন ছাড়</Text>
                    <Text className="text-[12px] font-semibold text-emerald-700">−{formatDropshippingTaka(couponDiscount)}</Text>
                  </View>
                ) : null}
                <View className="mb-2 flex-row justify-between">
                  <Text className="text-[12px] text-muted">আনুমানিক ডেলিভারি</Text>
                  <Text className="text-[12px] font-semibold text-ink">{formatDropshippingTaka(estimateDeliveryCharge)}</Text>
                </View>
                <View className="flex-row justify-between border-t border-line pt-2">
                  <Text className="text-[13px] font-bold text-ink">সার্ভার অর্ডারের আনুমানিক মোট</Text>
                  <Text className="text-[15px] font-extrabold text-primary">
                    {totalEstimate === undefined ? 'তথ্য নেই' : formatDropshippingTaka(totalEstimate)}
                  </Text>
                </View>
                <Text className="mt-2 text-[10px] leading-4 text-muted">
                  প্রস্তাবিত বিক্রয়মূল্য/লাভ অনুমান; বর্তমান API-তে custom selling price ও COD নেই। কুপন, ডেলিভারি ও চূড়ান্ত অর্ডার মোট সার্ভার নিশ্চিত করবে।
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={orderMutation.isPending || !quantityIsValid}
                onPress={placeOrder}
                className={`mt-4 min-h-12 flex-row items-center justify-center rounded-2xl px-5 py-3.5 ${orderMutation.isPending || !quantityIsValid ? 'bg-primary/50' : 'bg-primary'}`}
              >
                {orderMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="bag-check-outline" size={18} color="#FFFFFF" />
                    <Text className="ml-2 text-[13px] font-bold text-white">অর্ডার নিশ্চিত করুন</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <Modal
          animationType="slide"
          transparent
          visible={showProductPicker}
          onRequestClose={() => setShowProductPicker(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="max-h-[84%] rounded-t-3xl bg-white px-4 pb-6 pt-4">
              <View className="mb-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-[16px] font-bold text-ink">অর্ডারে পণ্য যোগ করুন</Text>
                  <Text className="mt-1 text-[10px] text-muted">নাম দিয়ে খুঁজুন; API থেকে live মূল্য আসবে</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="পণ্য নির্বাচন বন্ধ করুন"
                  onPress={() => setShowProductPicker(false)}
                  className="p-1"
                >
                  <Ionicons name="close" size={23} color={colors.ink} />
                </Pressable>
              </View>
              <TextInput
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="পণ্যের নাম লিখুন"
                placeholderTextColor={colors.muted}
                className="mb-3 rounded-xl border border-line bg-bg px-3 py-3 text-[13px] text-ink"
              />
              {searchProductsQuery.isPending && productSearch.trim().length >= 2 ? (
                <View className="items-center py-8">
                  <ActivityIndicator color={colors.primary} />
                  <Text className="mt-2 text-[11px] text-muted">পণ্য খোঁজা হচ্ছে...</Text>
                </View>
              ) : searchProductsQuery.isError ? (
                <Text className="py-6 text-center text-[12px] text-red-600">
                  {searchProductsQuery.error.message || 'পণ্য খোঁজা যায়নি।'}
                </Text>
              ) : productSearch.trim().length < 2 ? (
                <Text className="py-6 text-center text-[12px] text-muted">
                  খুঁজতে কমপক্ষে ২টি অক্ষর লিখুন।
                </Text>
              ) : (
                <FlatList
                  data={searchProductsQuery.data?.products ?? []}
                  keyExtractor={(searchProduct) => searchProduct.id}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    searchProductsQuery.isFetching ? (
                      <ActivityIndicator className="py-6" color={colors.primary} />
                    ) : (
                      <Text className="py-6 text-center text-[12px] text-muted">
                        কোনো পণ্য পাওয়া যায়নি।
                      </Text>
                    )
                  }
                  renderItem={({ item: searchProduct }) => {
                    const alreadyAdded = orderItems.some(
                      (orderItem) => orderItem.product.id === searchProduct.id
                    );
                    const unavailable = searchProduct.stockCount === 0;
                    return (
                      <View className="mb-2 flex-row items-center rounded-xl border border-line bg-bg p-2.5">
                        <Image
                          source={{ uri: searchProduct.images?.[0] ?? searchProduct.image }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={searchProduct.id}
                          style={{ width: 52, height: 52, borderRadius: 9, backgroundColor: '#F3F4F6' }}
                        />
                        <View className="ml-2.5 flex-1">
                          <Text numberOfLines={2} className="text-[11px] font-semibold text-ink">
                            {searchProduct.name}
                          </Text>
                          <Text className="mt-1 text-[10px] text-muted">
                            খরচ {searchProduct.dropshippingPrice === undefined
                              ? 'তথ্য নেই'
                              : formatDropshippingTaka(searchProduct.dropshippingPrice)}
                            {' · '}বিক্রি {searchProduct.productRank === undefined
                              ? 'তথ্য নেই'
                              : formatDropshippingTaka(searchProduct.productRank)}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          disabled={alreadyAdded || unavailable}
                          onPress={() => {
                            if (alreadyAdded || unavailable) return;
                            setOrderItems((current) => [...current, {
                              product: searchProduct,
                              quantity: '1',
                              size: searchProduct.sizes?.[0] ?? '',
                              color: searchProduct.colors?.[0] ?? '',
                              weight: searchProduct.weights?.[0] ?? '',
                            }]);
                            couponMutation.reset();
                            setShowProductPicker(false);
                          }}
                          className={`ml-2 rounded-lg px-3 py-2 ${alreadyAdded || unavailable ? 'bg-line' : 'bg-primary'}`}
                        >
                          <Text className={`text-[10px] font-bold ${alreadyAdded || unavailable ? 'text-muted' : 'text-white'}`}>
                            {alreadyAdded ? 'যোগ হয়েছে' : unavailable ? 'পাওয়া যাবে না' : 'যোগ করুন'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Modal>
        <Modal
          animationType="slide"
          transparent
          visible={locationPicker !== null}
          onRequestClose={() => setLocationPicker(null)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="max-h-[78%] rounded-t-3xl bg-white px-4 pb-6 pt-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-[16px] font-bold text-ink">
                  {locationPicker === 'division' ? 'বিভাগ নির্বাচন করুন' :
                    locationPicker === 'district' ? 'জেলা নির্বাচন করুন' : 'থানা / উপজেলা নির্বাচন করুন'}
                </Text>
                <Pressable onPress={() => setLocationPicker(null)} className="p-1">
                  <Ionicons name="close" size={23} color={colors.ink} />
                </Pressable>
              </View>
              <TextInput
                value={locationSearch}
                onChangeText={setLocationSearch}
                placeholder="খুঁজুন"
                placeholderTextColor={colors.muted}
                className="mb-3 rounded-xl border border-line bg-bg px-3 py-2.5 text-[13px] text-ink"
              />
              <FlatList
                data={filteredLocationOptions}
                keyExtractor={(option) => option}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text className="py-6 text-center text-[12px] text-muted">কোনো ফল পাওয়া যায়নি।</Text>
                }
                renderItem={({ item: option }) => (
                  <Pressable
                    onPress={() => {
                      if (locationPicker === 'division') {
                        setDivision(option);
                        setDistrict('');
                        setUpazila('');
                      } else if (locationPicker === 'district') {
                        setDistrict(option);
                        setUpazila('');
                      } else {
                        setUpazila(option);
                      }
                      setLocationPicker(null);
                    }}
                    className="border-b border-line py-3"
                  >
                    <Text className="text-[13px] text-ink">{option}</Text>
                  </Pressable>
                )}
              />
            </View>
          </View>
        </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

export default DropshippingOrderScreen;
