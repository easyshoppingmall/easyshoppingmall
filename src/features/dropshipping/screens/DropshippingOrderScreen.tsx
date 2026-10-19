import { useMemo, useState } from 'react';
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
import { useDropshippingProductDetailsQuery } from '../api/queries';

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

export function DropshippingOrderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    id?: string | string[];
    size?: string | string[];
    color?: string | string[];
    weight?: string | string[];
  }>();
  const productId = firstParam(params.id);
  const productQuery = useDropshippingProductDetailsQuery(productId);
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
  const [quantity, setQuantity] = useState('1');
  const [variantSelection, setVariantSelection] = useState({
    productId: '',
    size: '',
    color: '',
    weight: '',
  });
  const [paymentProvider, setPaymentProvider] = useState<DropshippingPaymentProvider>('bkash');
  const [paymentType, setPaymentType] = useState<DropshippingPaymentType>('delivery');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    productId: string;
    quantity: number;
    price: number;
    result: DropshippingCouponResult;
  }>();
  const [orderResult, setOrderResult] = useState<DropshippingOrderResult>();
  const [paymentRetryError, setPaymentRetryError] = useState('');

  const selectedSize = variantSelection.productId === product?.id
    ? variantSelection.size
    : firstParam(params.size) || product?.sizes?.[0] || '';
  const selectedColor = variantSelection.productId === product?.id
    ? variantSelection.color
    : firstParam(params.color) || product?.colors?.[0] || '';
  const selectedWeight = variantSelection.productId === product?.id
    ? variantSelection.weight
    : firstParam(params.weight) || product?.weights?.[0] || '';
  const changeVariant = (key: 'size' | 'color' | 'weight', value: string) => {
    if (!product) return;
    setVariantSelection({
      productId: product.id,
      size: key === 'size' ? value : selectedSize,
      color: key === 'color' ? value : selectedColor,
      weight: key === 'weight' ? value : selectedWeight,
    });
  };

  const parsedQuantity = Number(quantity);
  const unitPrice = product?.dropshippingPrice;
  const quantityIsValid = Number.isInteger(parsedQuantity) && parsedQuantity >= 1;
  const subtotal = unitPrice === undefined || !quantityIsValid ? 0 : unitPrice * parsedQuantity;
  const estimateDeliveryCharge = ['ঢাকা', 'dhaka'].includes(district.trim().toLocaleLowerCase())
    ? 80
    : 130;
  const activeCoupon =
    appliedCoupon &&
    appliedCoupon.code.toLocaleLowerCase() === couponCode.trim().toLocaleLowerCase() &&
    appliedCoupon.productId === product?.id &&
    appliedCoupon.quantity === parsedQuantity &&
    appliedCoupon.price === unitPrice
      ? appliedCoupon
      : undefined;
  const couponDiscount = activeCoupon?.result.discountAmount ?? 0;
  const totalEstimate = Math.max(0, subtotal + estimateDeliveryCharge - couponDiscount);
  const estimatedProfit =
    product?.productRank !== undefined && unitPrice !== undefined && quantityIsValid
      ? (product.productRank - unitPrice) * parsedQuantity
      : undefined;
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
  });

  const couponMutation = useMutation({
    mutationFn: ({ code, productId, quantity, price }: {
      code: string;
      productId: string;
      quantity: number;
      price: number;
    }) => applyDropshippingCoupon(code, productId, quantity, price),
    onSuccess: (result, variables) => {
      setAppliedCoupon({
        ...variables,
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
    if (!user?._id) {
      Alert.alert('লগইন প্রয়োজন', 'অর্ডার করার আগে আপনার অ্যাকাউন্টে লগইন করুন।');
      return;
    }
    if (!product || unitPrice === undefined) {
      Alert.alert('মূল্য পাওয়া যায়নি', 'এই পণ্যের dropshipping মূল্য না থাকায় অর্ডার করা যাচ্ছে না।');
      return;
    }
    if (product.stockCount !== undefined && product.stockCount <= 0) {
      Alert.alert('স্টক নেই', 'এই পণ্যটি বর্তমানে স্টকে নেই।');
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
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      Alert.alert('পরিমাণ যাচাই করুন', 'কমপক্ষে ১টি পণ্যের সঠিক পরিমাণ লিখুন।');
      return;
    }
    if (product.stockCount !== undefined && parsedQuantity > product.stockCount) {
      Alert.alert('স্টকের বেশি পরিমাণ', `সর্বোচ্চ ${formatDropshippingNumber(product.stockCount)}টি অর্ডার করতে পারবেন।`);
      return;
    }
    if (product.sizes?.length && !selectedSize) {
      Alert.alert('সাইজ বাছুন', 'অর্ডার করার আগে পণ্যের সাইজ নির্বাচন করুন।');
      return;
    }
    if (product.colors?.length && !selectedColor) {
      Alert.alert('রং বাছুন', 'অর্ডার করার আগে পণ্যের রং নির্বাচন করুন।');
      return;
    }
    if (product.weights?.length && !selectedWeight) {
      Alert.alert('ওজন বাছুন', 'অর্ডার করার আগে পণ্যের ওজন নির্বাচন করুন।');
      return;
    }
    if (!/^\d{10,14}$/.test(paymentNumber.trim()) || !transactionId.trim()) {
      Alert.alert('পেমেন্ট তথ্য যাচাই করুন', '১০–১৪ সংখ্যার পেমেন্ট নম্বর ও ট্রানজ্যাকশন আইডি দিন।');
      return;
    }

    const digits = phone.trim();
    const payload: CreateDropshippingOrderPayload = {
      userId: user._id,
      products: [{
        productId: product.id,
        name: product.name,
        image: product.images ?? (product.image ? [product.image] : []),
        price: unitPrice,
        quantity: parsedQuantity,
        totalPrice: subtotal,
        ...(selectedSize ? { size: selectedSize } : {}),
        ...(selectedColor ? { color: selectedColor } : {}),
        ...(selectedWeight ? { weight: selectedWeight } : {}),
      }],
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
      deliveryCharge: estimateDeliveryCharge,
      subTotalAmt: subtotal,
      totalAmt: totalEstimate,
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
      ...(activeCoupon ? { appliedCoupon: activeCoupon.result.coupon } : {}),
      couponDiscount,
    };
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
              <Text className="mb-2 text-[12px] font-extrabold text-ink">গ্রাহকের অর্ডার</Text>
              <Text className="text-[11px] text-muted">পণ্য: {product.name} × {formatDropshippingNumber(parsedQuantity)}</Text>
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
                  আনুমানিক পণ্য-মার্জিন: {formatDropshippingTaka(estimatedProfit)} (কুপন/চার্জের আগে)
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
              <View className="mb-4 flex-row rounded-2xl border border-line bg-white p-3">
                <Image
                  source={{ uri: product.images?.[0] ?? product.image }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: '#F3F4F6' }}
                />
                <View className="ml-3 flex-1 justify-center">
                  <Text numberOfLines={2} className="text-[13px] font-bold text-ink">{product.name}</Text>
                  <Text className="mt-1 text-[11px] text-muted">ড্রপশিপিং মূল্য</Text>
                  <Text className="text-[16px] font-extrabold text-primary">
                    {product.dropshippingPrice === undefined
                      ? 'মূল্য পাওয়া যায়নি'
                      : formatDropshippingTaka(product.dropshippingPrice)}
                  </Text>
                  <Text className="mt-2 text-[10px] text-muted">প্রস্তাবিত বিক্রয়মূল্য (Product Rank)</Text>
                  <Text className="text-[13px] font-bold text-ink">
                    {product.productRank === undefined
                      ? 'তথ্য পাওয়া যায়নি'
                      : formatDropshippingTaka(product.productRank)}
                  </Text>
                  {product.productRank !== undefined && product.dropshippingPrice !== undefined ? (
                    <Text className={`mt-1 text-[10px] font-bold ${product.productRank >= product.dropshippingPrice ? 'text-emerald-700' : 'text-red-600'}`}>
                      আনুমানিক লাভ: {formatDropshippingTaka(product.productRank - product.dropshippingPrice)} / পিস
                    </Text>
                  ) : null}
                  {product.stockCount !== undefined ? (
                    <Text className={`mt-1 text-[10px] ${product.stockCount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {product.stockCount > 0 ? `স্টকে ${formatDropshippingNumber(product.stockCount)}টি` : 'স্টক নেই'}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View className="rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">পণ্যের ভ্যারিয়েন্ট</Text>
                <ChoiceRow label="সাইজ" options={product.sizes ?? []} value={selectedSize} onSelect={(value) => changeVariant('size', value)} />
                <ChoiceRow label="রং" options={product.colors ?? []} value={selectedColor} onSelect={(value) => changeVariant('color', value)} />
                <ChoiceRow label="ওজন" options={product.weights ?? []} value={selectedWeight} onSelect={(value) => changeVariant('weight', value)} />
                <FormField
                  label="পরিমাণ"
                  value={quantity}
                  onChangeText={(value) => {
                    setQuantity(value);
                    couponMutation.reset();
                  }}
                  placeholder="১"
                  keyboardType="number-pad"
                />
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
                        !product.dropshippingPrice ||
                        !quantityIsValid
                      }
                      onPress={() => {
                        if (!product.dropshippingPrice) return;
                        couponMutation.mutate({
                          code: couponCode.trim(),
                          productId: product.id,
                          quantity: parsedQuantity,
                          price: product.dropshippingPrice,
                        });
                      }}
                      className={`min-h-11 min-w-20 items-center justify-center rounded-xl px-4 ${couponMutation.isPending || !couponCode.trim() ? 'bg-primary/50' : 'bg-primary'}`}
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
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">পেমেন্ট তথ্য</Text>
                <View className="mb-3 flex-row">
                  {([
                    ['bkash', 'বিকাশ'],
                    ['nagad', 'নগদ'],
                  ] as const).map(([provider, label]) => (
                    <Pressable
                      key={provider}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: paymentProvider === provider }}
                      onPress={() => setPaymentProvider(provider)}
                      className={`mr-2 flex-1 flex-row items-center justify-center rounded-xl border py-3 ${paymentProvider === provider ? 'border-primary bg-primary-light' : 'border-line bg-bg'}`}
                    >
                      <Ionicons name={paymentProvider === provider ? 'radio-button-on' : 'radio-button-off'} size={17} color={paymentProvider === provider ? colors.primary : colors.muted} />
                      <Text className="ml-2 text-[12px] font-semibold text-ink">{label}</Text>
                    </Pressable>
                  ))}
                </View>
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
                {estimatedProfit !== undefined ? (
                  <View className="mb-2 flex-row justify-between">
                    <Text className="text-[12px] text-muted">আনুমানিক লাভ (কুপন/চার্জের আগে)</Text>
                    <Text className={`text-[12px] font-bold ${estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatDropshippingTaka(estimatedProfit)}
                    </Text>
                  </View>
                ) : null}
                <View className="mb-2 flex-row justify-between">
                  <Text className="text-[12px] text-muted">পণ্য × পরিমাণ</Text>
                  <Text className="text-[12px] font-semibold text-ink">{formatDropshippingTaka(subtotal)}</Text>
                </View>
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
                  <Text className="text-[13px] font-bold text-ink">আনুমানিক মোট</Text>
                  <Text className="text-[15px] font-extrabold text-primary">{formatDropshippingTaka(totalEstimate)}</Text>
                </View>
                <Text className="mt-2 text-[10px] leading-4 text-muted">
                  চূড়ান্ত পণ্যমূল্য ও ডেলিভারি চার্জ সার্ভার নিশ্চিত করবে।
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={orderMutation.isPending || product.dropshippingPrice === undefined || product.stockCount === 0}
                onPress={placeOrder}
                className={`mt-4 min-h-12 flex-row items-center justify-center rounded-2xl px-5 py-3.5 ${orderMutation.isPending || product.dropshippingPrice === undefined || product.stockCount === 0 ? 'bg-primary/50' : 'bg-primary'}`}
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
