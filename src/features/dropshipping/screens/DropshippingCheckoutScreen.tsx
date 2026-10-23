import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import bdLocations from '../../../data/bd-dd-ui-bn';
import { colors } from '../../../shared/theme/colors';
import { clearDropshippingCart } from '../../../store/dropshippingCartSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  formatDropshippingNumber,
  formatDropshippingTaka,
  roundDropshippingMoney,
} from '../api/homeApi';
import { useDropshippingProfileQuery } from '../api/queries';
import {
  applyDropshippingCoupon,
  createDropshippingOrder,
  submitDropshippingManualPayment,
  type DropshippingPaymentProvider,
  type DropshippingPaymentMethod,
  type DropshippingPaymentType,
  type DropshippingOrderResult,
} from '../api/ordersApi';

interface BangladeshDistrict {
  district: string;
  upazilas: string[];
}

interface BangladeshDivision {
  division: string;
  districts: BangladeshDistrict[];
}

type LocationField = 'division' | 'district' | 'upazila';
type CheckoutStep = 'details' | 'review';
const bangladeshLocations = bdLocations as BangladeshDivision[];
const paymentProviders: { id: DropshippingPaymentProvider; label: string }[] = [
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'rocket', label: 'Rocket' },
  { id: 'upay', label: 'Upay' },
];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-[11px] font-semibold text-ink">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        className="min-h-11 rounded-xl border border-line bg-bg px-3.5 py-3 text-[13px] text-ink"
      />
    </View>
  );
}

function AmountRow({
  label,
  amount,
  emphasize = false,
  negative = false,
}: {
  label: string;
  amount?: number;
  emphasize?: boolean;
  negative?: boolean;
}) {
  return (
    <View className={`mb-2 flex-row justify-between ${emphasize ? 'border-t border-line pt-3' : ''}`}>
      <Text className={`${emphasize ? 'text-[13px] font-bold text-ink' : 'text-[11px] text-muted'}`}>
        {label}
      </Text>
      <Text className={`${emphasize ? 'text-[14px] font-extrabold' : 'text-[11px] font-semibold'} ${negative ? 'text-emerald-700' : emphasize ? 'text-primary' : 'text-ink'}`}>
        {amount === undefined
          ? 'তথ্য নেই'
          : `${negative ? '−' : ''}${formatDropshippingTaka(Math.abs(amount))}`}
      </Text>
    </View>
  );
}

export function DropshippingCheckoutScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const items = useAppSelector((state) => state.dropshippingCart.items);
  const profileQuery = useDropshippingProfileQuery();
  const [step, setStep] = useState<CheckoutStep>('details');
  const [submittedOrder, setSubmittedOrder] = useState<DropshippingOrderResult>();
  const [customerNameDraft, setCustomerNameDraft] = useState<string>();
  const [phoneDraft, setPhoneDraft] = useState<string>();
  const [address, setAddress] = useState('');
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [postCode, setPostCode] = useState('');
  const [locationPicker, setLocationPicker] = useState<LocationField | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DropshippingPaymentMethod>('manual');
  const [paymentProvider, setPaymentProvider] = useState<DropshippingPaymentProvider>('bkash');
  const [paymentType, setPaymentType] = useState<DropshippingPaymentType>('delivery');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    cartKey: string;
    discount: number;
  }>();

  const customerName = customerNameDraft ?? profileQuery.data?.name ?? user?.name ?? '';
  const phone = phoneDraft ??
    String(profileQuery.data?.mobile ?? profileQuery.data?.phone ?? user?.phone ?? '');
  const hasUnknownCost = items.some((item) =>
    item.product.dropshippingPrice === undefined ||
    !Number.isFinite(item.product.dropshippingPrice) ||
    item.product.dropshippingPrice <= 0
  );
  const cartKey = items
    .map((item) => `${item.key}:${item.quantity}:${item.product.dropshippingPrice ?? ''}`)
    .sort()
    .join('|');
  const activeCoupon = !hasUnknownCost && appliedCoupon &&
    appliedCoupon.code.toLowerCase() === couponCode.trim().toLowerCase() &&
    appliedCoupon.cartKey === cartKey
      ? appliedCoupon
      : undefined;
  const knownSubtotal = items.reduce(
    (total, item) => roundDropshippingMoney(
      total + roundDropshippingMoney((item.product.dropshippingPrice ?? 0) * item.quantity)
    ),
    0
  );
  const subtotal = hasUnknownCost ? undefined : knownSubtotal;
  const sellingTotal = items.reduce((total, item) => {
    const sellingPrice = Number(item.sellingPrice);
    return roundDropshippingMoney(total + (item.sellingPrice.trim() !== '' &&
      Number.isFinite(sellingPrice) &&
      sellingPrice >= 0
      ? roundDropshippingMoney(sellingPrice * item.quantity)
      : 0));
  }, 0);
  const estimatedProfit = hasUnknownCost
    ? undefined
    : roundDropshippingMoney(sellingTotal - knownSubtotal);
  const deliveryCharge = district.toLowerCase() === 'ঢাকা' || district.toLowerCase() === 'dhaka'
    ? 80
    : 130;
  const couponDiscount = roundDropshippingMoney(
    Math.min(activeCoupon?.discount ?? 0, knownSubtotal)
  );
  const estimatedCustomerPayable = roundDropshippingMoney(
    Math.max(0, sellingTotal + deliveryCharge - couponDiscount)
  );
  const couponMutation = useMutation({
    mutationFn: (variables: {
      code: string;
      cartKey: string;
      cartItems: { productId: string; quantity: number; price: number }[];
    }) => applyDropshippingCoupon(variables.code, variables.cartItems),
    onSuccess: (result, variables) => {
      setAppliedCoupon({
        code: variables.code,
        cartKey: variables.cartKey,
        discount: result.discountAmount,
      });
    },
    onError: (error) => {
      Alert.alert(
        'কুপন প্রয়োগ হয়নি',
        error instanceof Error ? error.message : 'আবার চেষ্টা করুন।'
      );
    },
  });

  const locationOptions = useMemo(() => {
    if (locationPicker === 'division') {
      return bangladeshLocations.map((location) => location.division);
    }
    if (locationPicker === 'district') {
      return bangladeshLocations.find((location) => location.division === division)
        ?.districts.map((location) => location.district) ?? [];
    }
    if (locationPicker === 'upazila') {
      return bangladeshLocations.find((location) => location.division === division)
        ?.districts.find((location) => location.district === district)
        ?.upazilas ?? [];
    }
    return [];
  }, [district, division, locationPicker]);
  const filteredLocationOptions = locationOptions.filter((option) =>
    option.toLowerCase().includes(locationSearch.trim().toLowerCase())
  );

  const validateCheckout = (): boolean => {
    if (!items.length) {
      Alert.alert('কার্ট খালি', 'Checkout করার আগে Dropshipping Cart-এ পণ্য যোগ করুন।');
      return false;
    }
    const invalidSellingPriceItem = items.find((item) => {
      const value = Number(item.sellingPrice);
      return !item.sellingPrice.trim() || !Number.isFinite(value) || value <= 0;
    });
    if (invalidSellingPriceItem) {
      Alert.alert('Selling Price যাচাই করুন', `${invalidSellingPriceItem.product.name}-এর বিক্রয়মূল্য লিখুন।`);
      return false;
    }
    const overStockItem = items.find((item) =>
      item.product.stockCount !== undefined && item.quantity > item.product.stockCount
    );
    if (overStockItem) {
      Alert.alert('স্টক পর্যাপ্ত নয়', `${overStockItem.product.name}-এর স্টক ${formatDropshippingNumber(overStockItem.product.stockCount ?? 0)}টি।`);
      return false;
    }
    if (!customerName.trim() || !address.trim() || !division || !district || !upazila) {
      Alert.alert('Customer/Address অসম্পূর্ণ', 'গ্রাহকের নাম, ফোন এবং সম্পূর্ণ ডেলিভারি ঠিকানা পূরণ করুন।');
      return false;
    }
    if (!/^\d{10,14}$/.test(phone.replace(/\D/g, ''))) {
      Alert.alert('Phone Number যাচাই করুন', '১০–১৪ সংখ্যার একটি সঠিক ফোন নম্বর লিখুন।');
      return false;
    }
    if (paymentMethod === 'manual' &&
        (!/^\d{10,14}$/.test(paymentNumber.replace(/\D/g, '')) || !transactionId.trim())) {
      Alert.alert('Payment তথ্য অসম্পূর্ণ', 'Manual payment-এর sender number এবং Transaction ID লিখুন।');
      return false;
    }
    return true;
  };

  const orderMutation = useMutation({
    mutationFn: async () => {
      const manualPayment = paymentMethod === 'manual'
        ? {
            transactionId: transactionId.trim(),
            manual: {
              provider: paymentProvider,
              senderNumber: paymentNumber.replace(/\D/g, ''),
              transactionId: transactionId.trim(),
            },
          }
        : undefined;
      return createDropshippingOrder({
        products: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          sellingPrice: Number(item.sellingPrice),
          ...(item.size ? { size: item.size } : {}),
          ...(item.color ? { color: item.color } : {}),
          ...(item.weight ? { weight: item.weight } : {}),
        })),
        delivery_address: {
          customer_name: customerName.trim(),
          address_line: address.trim(),
          district,
          division,
          upazila_thana: upazila,
          pincode: postCode.trim(),
          country: 'Bangladesh',
          mobile: Number(phone.replace(/\D/g, '')),
        },
        payment_method: paymentMethod,
        payment_type: paymentMethod === 'cod' ? 'cod' : paymentType,
        ...(manualPayment ? { payment_details: manualPayment } : {}),
        ...(activeCoupon ? { appliedCoupon: activeCoupon.code } : {}),
      });
    },
    onSuccess: (result) => {
      dispatch(clearDropshippingCart());
      setSubmittedOrder(result);
    },
    onError: (error) => {
      Alert.alert(
        'অর্ডার তৈরি হয়নি',
        error instanceof Error ? error.message : 'আবার চেষ্টা করুন।'
      );
    },
  });
  const paymentRetryMutation = useMutation({
    mutationFn: async () => {
      if (!submittedOrder?.paymentReference || paymentMethod !== 'manual') {
        throw new Error('এই অর্ডারের Manual Payment আবার জমা দেওয়া যাচ্ছে না।');
      }
      return submitDropshippingManualPayment(
        submittedOrder.paymentReference,
        paymentProvider,
        paymentNumber.replace(/\D/g, ''),
        transactionId.trim()
      );
    },
    onSuccess: () => {
      setSubmittedOrder((current) => current
        ? { ...current, paymentWarning: undefined }
        : current);
    },
    onError: (error) => {
      setSubmittedOrder((current) => current
        ? {
            ...current,
            paymentWarning: error instanceof Error
              ? error.message
              : 'পেমেন্ট তথ্য জমা হয়নি। আবার চেষ্টা করুন।',
          }
        : current);
    },
  });

  if (submittedOrder) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg px-6">
        <View className="w-full max-w-[520px] items-center rounded-[24px] border border-line bg-white p-6">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <Ionicons name="checkmark-circle" size={42} color="#059669" />
          </View>
          <Text className="mt-4 text-center text-[19px] font-extrabold text-ink">অর্ডার সফল হয়েছে</Text>
          <Text className="mt-2 text-center text-[12px] text-muted">Order ID: {submittedOrder.orderId}</Text>
          {submittedOrder.orderTotal !== undefined ? (
            <Text className="mt-2 text-[13px] font-bold text-primary">
              Backend Total: {formatDropshippingTaka(submittedOrder.orderTotal)}
            </Text>
          ) : null}
          {submittedOrder.paymentWarning ? (
            <>
              <Text className="mt-3 text-center text-[11px] leading-5 text-amber-800">
                {submittedOrder.paymentWarning}
              </Text>
              {paymentMethod === 'manual' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={paymentRetryMutation.isPending}
                  onPress={() => paymentRetryMutation.mutate()}
                  className="mt-3 min-h-11 w-full items-center justify-center rounded-xl border border-amber-400 bg-amber-50 px-4"
                >
                  {paymentRetryMutation.isPending
                    ? <ActivityIndicator size="small" color="#B45309" />
                    : <Text className="text-[12px] font-bold text-amber-900">পেমেন্ট তথ্য আবার জমা দিন</Text>}
                </Pressable>
              ) : null}
            </>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(dropshipping)/all-products')}
            className="mt-6 min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5"
          >
            <Text className="text-[13px] font-bold text-white">আরও পণ্য দেখুন</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!items.length) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg px-6">
        <Ionicons name="cart-outline" size={46} color={colors.primary} />
        <Text className="mt-4 text-[15px] font-extrabold text-ink">Checkout করার মতো পণ্য নেই</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(dropshipping)/all-products')}
          className="mt-5 rounded-xl bg-primary px-5 py-3"
        >
          <Text className="text-[12px] font-bold text-white">পণ্য দেখুন</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="কার্টে ফিরে যান"
          onPress={() => step === 'review' ? setStep('details') : router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[16px] font-extrabold text-ink">
            {step === 'details' ? 'Checkout' : 'Review Order'}
          </Text>
          <Text className="mt-0.5 text-[10px] text-muted">
            {step === 'details' ? 'Customer, delivery ও payment তথ্য' : 'Confirm করার আগে সব তথ্য যাচাই করুন'}
          </Text>
        </View>
        <View className="rounded-full bg-primary-light px-3 py-1.5">
          <Text className="text-[10px] font-bold text-primary">{step === 'details' ? 'STEP 1/2' : 'STEP 2/2'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 'details' ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 }}
          >
            <View className="w-full max-w-[760px]">
              <View className="rounded-[22px] border border-line bg-white p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-[14px] font-extrabold text-ink">Order Items</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.back()}>
                    <Text className="text-[11px] font-bold text-primary">পণ্য/দাম Edit</Text>
                  </Pressable>
                </View>
                {items.map((item) => {
                  const image = item.product.images?.[0] ?? item.product.image;
                  const price = Number(item.sellingPrice);
                  const lineSellingTotal = Number.isFinite(price) ? price * item.quantity : 0;
                  return (
                    <View key={item.key} className="mb-3 flex-row rounded-2xl border border-line bg-bg p-3">
                      {image ? (
                        <Image
                          source={{ uri: image }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={item.product.id}
                          style={{ width: 65, height: 65, borderRadius: 11, backgroundColor: '#F3F4F6' }}
                        />
                      ) : null}
                      <View className="ml-3 flex-1 justify-center">
                        <Text numberOfLines={2} className="text-[11px] font-bold text-ink">{item.product.name}</Text>
                        <Text className="mt-1 text-[10px] text-muted">
                          Dropshipping Cost: {item.product.dropshippingPrice === undefined
                            ? 'API-তে নেই'
                            : formatDropshippingTaka(item.product.dropshippingPrice)}
                          {' · '}Qty {formatDropshippingNumber(item.quantity)}
                        </Text>
                        <Text className="mt-1 text-[10px] font-semibold text-primary">
                          Selling total: {formatDropshippingTaka(lineSellingTotal)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">Customer Information</Text>
                {profileQuery.isError ? (
                  <View className="mb-3 flex-row items-center rounded-xl bg-amber-50 px-3 py-2.5">
                    <Text className="flex-1 text-[10px] leading-4 text-amber-900">
                      Profile info load হয়নি। তথ্যগুলো নিজে লিখুন অথবা আবার চেষ্টা করুন।
                    </Text>
                    <Pressable accessibilityRole="button" onPress={() => void profileQuery.refetch()}>
                      <Text className="ml-2 text-[10px] font-bold text-primary">Retry</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Field label="গ্রাহকের নাম" value={customerName} onChangeText={setCustomerNameDraft} placeholder="সম্পূর্ণ নাম" />
                <Field label="Phone Number" value={phone} onChangeText={setPhoneDraft} placeholder="01XXXXXXXXX" keyboardType="phone-pad" />
                <Field label="বাড়ি / রাস্তা / এলাকার ঠিকানা" value={address} onChangeText={setAddress} placeholder="সম্পূর্ণ ডেলিভারি ঠিকানা" />
                {([
                  ['division', 'বিভাগ', division, false],
                  ['district', 'জেলা', district, !division],
                  ['upazila', 'এলাকা / উপজেলা', upazila, !district],
                ] as const).map(([field, label, value, disabled]) => (
                  <View key={field} className="mb-3">
                    <Text className="mb-1.5 text-[11px] font-semibold text-ink">{label}</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={disabled}
                      onPress={() => {
                        setLocationSearch('');
                        setLocationPicker(field);
                      }}
                      className={`min-h-11 flex-row items-center justify-between rounded-xl border border-line px-3.5 py-3 ${disabled ? 'bg-line/40' : 'bg-bg'}`}
                    >
                      <Text className={`text-[13px] ${value ? 'text-ink' : 'text-muted'}`}>
                        {value || `${label} নির্বাচন করুন`}
                      </Text>
                      <Ionicons name="chevron-down" size={17} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
                <Field label="Post Code (ঐচ্ছিক)" value={postCode} onChangeText={setPostCode} placeholder="Post Code" keyboardType="number-pad" />
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-[14px] font-extrabold text-ink">Coupon / Discount</Text>
                  {activeCoupon ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setCouponCode('');
                        setAppliedCoupon(undefined);
                      }}
                    >
                      <Text className="text-[11px] font-bold text-red-600">Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                {hasUnknownCost ? (
                  <Text className="mb-2 text-[10px] leading-4 text-amber-800">
                    কিছু পণ্যের Dropshipping Cost API-তে নেই, তাই কুপনের মূল্য যাচাই করা যাচ্ছে না।
                  </Text>
                ) : null}
                <View className="flex-row items-center">
                  <TextInput
                    value={couponCode}
                    onChangeText={(value) => {
                      setCouponCode(value);
                      setAppliedCoupon(undefined);
                    }}
                    placeholder="কুপন কোড"
                    autoCapitalize="characters"
                    placeholderTextColor={colors.muted}
                    className="mr-2 min-h-11 flex-1 rounded-xl border border-line bg-bg px-3 text-[12px] text-ink"
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={!couponCode.trim() || couponMutation.isPending || hasUnknownCost}
                    onPress={() => couponMutation.mutate({
                      code: couponCode.trim(),
                      cartKey,
                      cartItems: items.map((item) => ({
                        productId: item.product.id,
                        quantity: item.quantity,
                        price: item.product.dropshippingPrice ?? 0,
                      })),
                    })}
                    className={`min-h-11 min-w-20 items-center justify-center rounded-xl px-4 ${!couponCode.trim() || couponMutation.isPending || hasUnknownCost ? 'bg-primary/50' : 'bg-primary'}`}
                  >
                    {couponMutation.isPending
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <Text className="text-[11px] font-bold text-white">প্রয়োগ</Text>}
                  </Pressable>
                </View>
                {activeCoupon ? (
                  <Text className="mt-2 text-[10px] font-semibold text-emerald-700">
                    Coupon applied · {formatDropshippingTaka(couponDiscount)} discount
                  </Text>
                ) : null}
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">Payment Information</Text>
                <Text className="mb-2 text-[10px] leading-4 text-muted">
                  Backend-এর supported Manual Payment অথবা Cash on Delivery বেছে নিন।
                </Text>
                <View className="mb-3 flex-row">
                  {([
                    ['manual', 'Manual Payment'],
                    ['cod', 'Cash on Delivery'],
                  ] as const).map(([method, label]) => (
                    <Pressable
                      key={method}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: paymentMethod === method }}
                      onPress={() => setPaymentMethod(method)}
                      className={`mr-2 flex-1 flex-row items-center justify-center rounded-xl border px-2 py-3 ${paymentMethod === method ? 'border-primary bg-primary-light' : 'border-line bg-bg'}`}
                    >
                      <Ionicons
                        name={paymentMethod === method ? 'radio-button-on' : 'radio-button-off'}
                        size={17}
                        color={paymentMethod === method ? colors.primary : colors.muted}
                      />
                      <Text className="ml-2 text-[11px] font-semibold text-ink">{label}</Text>
                    </Pressable>
                  ))}
                </View>
                {paymentMethod === 'manual' ? (
                  <>
                    <View className="mb-2 flex-row flex-wrap justify-between">
                      {paymentProviders.map((provider) => (
                        <Pressable
                          key={provider.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: paymentProvider === provider.id }}
                          onPress={() => setPaymentProvider(provider.id)}
                          className={`mb-2 w-[48%] flex-row items-center justify-center rounded-xl border py-3 ${paymentProvider === provider.id ? 'border-primary bg-primary-light' : 'border-line bg-bg'}`}
                        >
                          <Ionicons
                            name={paymentProvider === provider.id ? 'radio-button-on' : 'radio-button-off'}
                            size={17}
                            color={paymentProvider === provider.id ? colors.primary : colors.muted}
                          />
                          <Text className="ml-2 text-[12px] font-semibold text-ink">{provider.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Field label="যে নম্বর থেকে পেমেন্ট করেছেন" value={paymentNumber} onChangeText={setPaymentNumber} placeholder="01XXXXXXXXX" keyboardType="phone-pad" />
                    <Field label="Transaction ID" value={transactionId} onChangeText={setTransactionId} placeholder="TrxID" />
                    <Text className="mb-2 text-[11px] font-bold text-ink">Payment Type</Text>
                    <View className="flex-row">
                      {([
                        ['delivery', 'ডেলিভারি চার্জ'],
                        ['full', 'সম্পূর্ণ পেমেন্ট'],
                      ] as const).map(([type, label]) => (
                    <Pressable
                      key={type}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: paymentType === type }}
                      onPress={() => setPaymentType(type)}
                      className={`mr-2 flex-1 rounded-xl border p-3 ${paymentType === type ? 'border-primary bg-primary-light' : 'border-line bg-bg'}`}
                    >
                      <Text className={`text-center text-[10px] font-semibold ${paymentType === type ? 'text-primary-dark' : 'text-ink'}`}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                    </View>
                  </>
                ) : (
                  <Text className="text-[11px] leading-5 text-muted">
                    গ্রাহক পণ্য গ্রহণের সময় Backend-এর নির্ধারিত মোট টাকা Cash on Delivery হিসেবে পরিশোধ করবেন।
                  </Text>
                )}
              </View>

              <OrderSummary
                subtotal={subtotal}
                sellingTotal={sellingTotal}
                profit={estimatedProfit}
                deliveryCharge={deliveryCharge}
                couponDiscount={couponDiscount}
                estimatedCustomerPayable={estimatedCustomerPayable}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (validateCheckout()) setStep('review');
                }}
                className="mt-4 min-h-12 flex-row items-center justify-center rounded-2xl bg-primary px-5 py-3.5"
              >
                <Text className="text-[13px] font-bold text-white">Review Order</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 }}
          >
            <View className="w-full max-w-[760px]">
              <View className="rounded-[22px] border border-line bg-white p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-[14px] font-extrabold text-ink">Customer & Delivery</Text>
                  <Pressable accessibilityRole="button" onPress={() => setStep('details')}>
                    <Text className="text-[11px] font-bold text-primary">Edit</Text>
                  </Pressable>
                </View>
                <Text className="text-[12px] font-bold text-ink">{customerName.trim()}</Text>
                <Text className="mt-1 text-[11px] text-muted">{phone}</Text>
                <Text className="mt-2 text-[11px] leading-5 text-muted">
                  {address.trim()}, {upazila}, {district}, {division}{postCode.trim() ? ` · ${postCode.trim()}` : ''}
                </Text>
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">
                  Products · {formatDropshippingNumber(items.length)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.back()}
                  className="mb-3 self-start"
                >
                  <Text className="text-[11px] font-bold text-primary">পণ্য, Quantity ও Selling Price Edit করুন</Text>
                </Pressable>
                {items.map((item) => {
                  const sellingPrice = Number(item.sellingPrice);
                  const cost = item.product.dropshippingPrice ?? 0;
                  return (
                    <View key={item.key} className="mb-3 border-b border-line pb-3">
                      <Text className="text-[12px] font-bold text-ink">{item.product.name}</Text>
                      <Text className="mt-1 text-[10px] text-muted">
                        Quantity {formatDropshippingNumber(item.quantity)}
                        {' · '}Dropshipping Cost {item.product.dropshippingPrice === undefined
                          ? 'API-তে নেই'
                          : `${formatDropshippingTaka(cost)} / পিস`}
                      </Text>
                      <Text className="mt-1 text-[10px] text-muted">
                        Customer Selling Price {formatDropshippingTaka(sellingPrice)} / পিস
                        {' · '}লাইন মোট {formatDropshippingTaka(roundDropshippingMoney(sellingPrice * item.quantity))}
                      </Text>
                      <Text className="mt-1 text-[10px] font-semibold text-ink">
                        মোট Cost {item.product.dropshippingPrice === undefined
                          ? 'তথ্য নেই'
                          : formatDropshippingTaka(roundDropshippingMoney(cost * item.quantity))}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
                <Text className="mb-3 text-[14px] font-extrabold text-ink">Payment</Text>
                {paymentMethod === 'cod' ? (
                  <Text className="text-[12px] font-semibold text-ink">Cash on Delivery</Text>
                ) : (
                  <>
                    <Text className="text-[12px] font-semibold text-ink">
                      Manual · {paymentProviders.find((provider) => provider.id === paymentProvider)?.label}
                    </Text>
                    <Text className="mt-1 text-[11px] text-muted">
                      Sender: {paymentNumber} · TrxID: {transactionId}
                    </Text>
                    <Text className="mt-1 text-[11px] text-muted">
                      {paymentType === 'delivery' ? 'Delivery charge payment' : 'Full payment'}
                    </Text>
                  </>
                )}
              </View>

              <OrderSummary
                subtotal={subtotal}
                sellingTotal={sellingTotal}
                profit={estimatedProfit}
                deliveryCharge={deliveryCharge}
                couponDiscount={couponDiscount}
                estimatedCustomerPayable={estimatedCustomerPayable}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: orderMutation.isPending }}
                disabled={orderMutation.isPending}
                onPress={() => {
                  if (validateCheckout()) orderMutation.mutate();
                }}
                className={`mt-4 min-h-12 flex-row items-center justify-center rounded-2xl px-5 py-3.5 ${orderMutation.isPending ? 'bg-primary/55' : 'bg-primary'}`}
              >
                {orderMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
                    <Text className="ml-2 text-[13px] font-bold text-white">Confirm Order</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep('details')}
                className="mt-3 min-h-11 items-center justify-center rounded-xl border border-line bg-white"
              >
                <Text className="text-[12px] font-bold text-ink">Edit Checkout Information</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
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
                {locationPicker === 'division' ? 'বিভাগ নির্বাচন করুন'
                  : locationPicker === 'district' ? 'জেলা নির্বাচন করুন'
                    : 'এলাকা / উপজেলা নির্বাচন করুন'}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setLocationPicker(null)}>
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
    </SafeAreaView>
  );
}

function OrderSummary({
  subtotal,
  sellingTotal,
  profit,
  deliveryCharge,
  couponDiscount,
  estimatedCustomerPayable,
}: {
  subtotal?: number;
  sellingTotal: number;
  profit?: number;
  deliveryCharge: number;
  couponDiscount: number;
  estimatedCustomerPayable: number;
}) {
  return (
    <View className="mt-4 rounded-[22px] border border-line bg-white p-4">
      <Text className="mb-3 text-[14px] font-extrabold text-ink">Order Summary</Text>
      <AmountRow label="Total Dropshipping Cost" amount={subtotal} />
      <AmountRow label="Total Selling Price" amount={sellingTotal} />
      <View className="mb-2 flex-row justify-between">
        <Text className="text-[11px] text-muted">Estimated Profit (selling − cost)</Text>
        <Text className={`text-[11px] font-bold ${profit === undefined ? 'text-muted' : profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          {profit === undefined ? 'তথ্য নেই' : formatDropshippingTaka(profit)}
        </Text>
      </View>
      <AmountRow label="আনুমানিক Delivery Charge" amount={deliveryCharge} />
      {couponDiscount > 0 ? (
        <AmountRow label="API Coupon Discount" amount={couponDiscount} negative />
      ) : null}
      <AmountRow
        label="আনুমানিক Customer Payable"
        amount={estimatedCustomerPayable}
        emphasize
      />
      <Text className="mt-2 text-[10px] leading-4 text-muted">
        Estimated Profit এবং Customer Payable আলাদা হিসাব। চূড়ান্ত Delivery Charge, Discount ও Payable Backend-এর হিসাব অনুযায়ী হবে।
      </Text>
    </View>
  );
}
