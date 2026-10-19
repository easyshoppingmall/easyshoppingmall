import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { clearCart, removeFromCart, setCartItems } from '../../../store/cartSlice';
import bdLocations from '../../../data/bd-dd-ui-bn';
import { formatTaka, isRemoteImage, toBengaliNumber } from '../data/catalog';
import { colors } from '../../../shared/theme/colors';
import {
  customerApi,
  mapCartItems,
  responseMessage,
  type Address,
  type CreateOrderPayload,
  type CustomerOrder,
  type ManualPaymentPayload,
} from '../api/customerApi';

type PaymentMethod = ManualPaymentPayload['provider'];
type PaymentType = CreateOrderPayload['payment_type'];
type LocationField = 'division' | 'district' | 'upazila';

interface BangladeshDistrict {
  district: string;
  upazilas: string[];
}

interface BangladeshDivision {
  division: string;
  districts: BangladeshDistrict[];
}

const bangladeshLocations = bdLocations as BangladeshDivision[];

function orderReference(order: CustomerOrder): string {
  return order.orderId ?? order.orderNumber ?? order._id ?? order.id ?? 'আইডি পাওয়া যায়নি';
}

function errorMessage(error: unknown, fallback: string): string {
  return responseMessage(error, fallback);
}

export const CartScreen: React.FC = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const checkoutInProgress = useRef(false);
  const user = useAppSelector((state) => state.auth.user);
  const userId = user?._id;
  const items = useAppSelector((state) => state.cart.items);
  const [customerName, setCustomerName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [postCode, setPostCode] = useState('');
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [locationPicker, setLocationPicker] = useState<LocationField | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [appliedCouponCartKey, setAppliedCouponCartKey] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notice, setNotice] = useState<string>();

  const cartQuery = useQuery({
    queryKey: ['customer', 'cart', userId],
    queryFn: async () => mapCartItems(await customerApi.getCart(userId!)),
    enabled: Boolean(userId),
  });
  const addressesQuery = useQuery({
    queryKey: ['customer', 'addresses', userId],
    queryFn: customerApi.getAddresses,
    enabled: Boolean(userId),
  });
  const serverItems = cartQuery.data ?? [];
  const cartItems = serverItems.length || cartQuery.data ? serverItems : items;
  useEffect(() => {
    if (cartQuery.data) dispatch(setCartItems(cartQuery.data));
  }, [cartQuery.data, dispatch]);
  const totalQuantity = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );
  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems]
  );
  const couponCartKey = useMemo(
    () => cartItems.map((item) => `${item.id}:${item.quantity}:${item.price}`).sort().join('|'),
    [cartItems]
  );
  const couponNeedsRecheck = Boolean(appliedCouponCode && appliedCouponCartKey !== couponCartKey);
  const activeCouponCode = couponNeedsRecheck ? null : appliedCouponCode;
  const activeDiscountAmount = couponNeedsRecheck ? 0 : discountAmount;
  const isDropshipper = user?.role === 'DROPSHIPPING';
  const deliveryCharge = district ? (district === 'ঢাকা' ? 80 : 130) : 0;
  const grandTotal = Math.max(0, subtotal + deliveryCharge - activeDiscountAmount);
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

  const updateCartMutation = useMutation({
    mutationFn: customerApi.updateCartItem,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customer', 'cart', userId] }),
    onError: (error) => Alert.alert('কার্ট আপডেট হয়নি', errorMessage(error, 'আবার চেষ্টা করুন।')),
  });
  const removeCartMutation = useMutation({
    mutationFn: (productId: string) => customerApi.removeCartItem(userId!, productId),
    onSuccess: (_, productId) => {
      dispatch(removeFromCart(productId));
      void queryClient.invalidateQueries({ queryKey: ['customer', 'cart', userId] });
    },
    onError: (error) => Alert.alert('পণ্য সরানো যায়নি', errorMessage(error, 'আবার চেষ্টা করুন।')),
  });
  const applyCouponMutation = useMutation({
    mutationFn: (code: string) => isDropshipper
      ? customerApi.applyDropshippingCoupon({
          code,
          cartItems: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
        })
      : customerApi.applyCoupon({ code }),
    onSuccess: (response) => {
      const root = response as Record<string, unknown>;
      const data = (root.data ?? root) as Record<string, unknown>;
      const coupon = data.coupon as Record<string, unknown> | undefined;
      const value = Number(data.discountAmount);
      if (!Number.isFinite(value) || value <= 0) {
        setDiscountAmount(0);
        setAppliedCouponCode(null);
        setAppliedCouponCartKey('');
        setNotice(typeof root.message === 'string' ? root.message : 'কুপনটি প্রযোজ্য নয়।');
      } else {
        setDiscountAmount(Math.min(value, subtotal));
        setAppliedCouponCode(typeof coupon?.code === 'string' ? coupon.code : couponCode.trim().toUpperCase());
        setAppliedCouponCartKey(couponCartKey);
        setNotice(typeof root.message === 'string' ? root.message : 'কুপন প্রয়োগ হয়েছে।');
      }
    },
    onError: (error) => {
      setDiscountAmount(0);
      setAppliedCouponCode(null);
      setAppliedCouponCartKey('');
      setNotice(errorMessage(error, 'কুপন প্রয়োগ করা যায়নি।'));
    },
  });
  const checkoutMutation = useMutation({
    mutationFn: async (paymentType: PaymentType) => {
      if (checkoutInProgress.current) throw new Error('অর্ডারটি ইতিমধ্যে পাঠানো হচ্ছে।');
      checkoutInProgress.current = true;
      try {
        if (!userId) throw new Error('অর্ডার করতে লগইন করুন।');
        if (!cartItems.length) throw new Error('কার্টে কোনো পণ্য নেই।');

        const checkoutPayload: CreateOrderPayload = {
          userId,
          products: cartItems.map((item) => ({
            productId: item.id,
            name: item.name,
            image: isRemoteImage(item.image) ? [item.image] : [],
            price: item.price,
            quantity: item.quantity,
            totalPrice: item.price * item.quantity,
            size: item.selectedSize,
            color: item.selectedColor,
          })),
          delivery_address: {
            customer_name: customerName.trim(),
            address_line: deliveryAddress.trim(),
            district,
            division,
            upazila_thana: upazila,
            pincode: postCode.trim(),
            country: 'Bangladesh',
            mobile: phoneNumber.trim() ? Number(phoneNumber.trim()) : null,
          },
          deliveryCharge,
          subTotalAmt: subtotal,
          totalAmt: grandTotal,
          payment_method: 'manual',
          payment_type: paymentType,
          payment_details: {
            transactionId: transactionId.trim(),
            manual: {
              provider: paymentMethod,
              senderNumber: paymentPhone.trim(),
              transactionId: transactionId.trim(),
            },
          },
          appliedCoupon: activeCouponCode,
          couponDiscount: activeDiscountAmount,
        };

        const order = await customerApi.createManualOrder(checkoutPayload);
        const id = order._id ?? order.id ?? order.orderId ?? order.orderNumber;
        let paymentWarning: string | undefined;
        let finalOrder = order;
        if (id) {
          try {
            const paymentPayload: ManualPaymentPayload = {
              orderId: id,
              provider: paymentMethod,
              senderNumber: paymentPhone.trim(),
              transactionId: transactionId.trim(),
            };
            const paymentResponse = await customerApi.submitManualPayment(paymentPayload);
            finalOrder = { ...order, ...paymentResponse };
          } catch (error) {
            paymentWarning = errorMessage(error, 'পেমেন্ট তথ্য জমা দেওয়া যায়নি।');
          }
        } else {
          paymentWarning = 'অর্ডারের ID পাওয়া যায়নি, তাই পেমেন্ট তথ্য জমা দেওয়া যায়নি।';
        }
        return { order: finalOrder, paymentWarning };
      } finally {
        checkoutInProgress.current = false;
      }
    },
    onSuccess: async (result) => {
      dispatch(clearCart());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer', 'cart', userId] }),
        queryClient.invalidateQueries({ queryKey: ['customer', 'orders', userId] }),
      ]);
      const order = result.order;
      const orderId = orderReference(order);
      const orderStatus = order.order_status ?? order.status ?? 'pending';
      const paymentStatus = order.payment_status ?? order.paymentStatus ?? 'pending';
      const orderTotal = Number(order.totalAmt ?? order.totalAmount ?? order.totalPrice);
      const paymentTypeLabel = order.payment_type === 'delivery' ? 'শুধু ডেলিভারি চার্জ' : 'সম্পূর্ণ পেমেন্ট';
      const paymentStatusLabel = paymentStatus === 'submitted'
        ? 'জমা হয়েছে · অ্যাডমিন যাচাই করবেন'
        : paymentStatus === 'pending'
          ? 'অপেক্ষমাণ · অ্যাডমিন যাচাই করবেন'
          : String(paymentStatus);
      Alert.alert(
        result.paymentWarning ? 'অর্ডার তৈরি হয়েছে' : 'অর্ডার সফলভাবে জমা হয়েছে',
        [
          `অর্ডার নম্বর: ${orderId}`,
          `অর্ডারের অবস্থা: ${String(orderStatus)}`,
          `পেমেন্টের ধরন: ${paymentTypeLabel}`,
          `পেমেন্টের অবস্থা: ${paymentStatusLabel}`,
          Number.isFinite(orderTotal) && orderTotal > 0 ? `সার্ভার নির্ধারিত মোট: ${formatTaka(orderTotal)}` : '',
          result.paymentWarning
            ? `\nপেমেন্ট তথ্য জমা হয়নি: ${result.paymentWarning}\nঅর্ডারটি তৈরি হয়েছে; অর্ডার বিস্তারিত থেকে আবার চেষ্টা করুন।`
            : '\nপেমেন্ট তথ্য যাচাইয়ের জন্য পাঠানো হয়েছে। অ্যাডমিন নিশ্চিত করার পর পেমেন্টের অবস্থা আপডেট হবে।',
        ].filter(Boolean).join('\n'),
        [{
          text: 'অর্ডার বিস্তারিত',
          onPress: () => order._id
            ? router.push({ pathname: '/(ecommerce)/order/[id]', params: { id: order._id } })
            : router.push('/(ecommerce)/(tabs)/profile'),
        }]
      );
    },
    onError: (error) => setNotice(errorMessage(error, 'অর্ডার সম্পন্ন করা যায়নি।')),
  });

  const handleSelectAddress = (address: Address) => {
    setCustomerName(user?.name ?? '');
    setPhoneNumber(String(address.mobile ?? user?.phone ?? ''));
    setDeliveryAddress(address.address_line ?? '');
    setPostCode(address.pincode ?? '');
    const savedDistrict = address.district ?? '';
    const savedDivision =
      address.division ??
      bangladeshLocations.find((location) =>
        location.districts.some((entry) => entry.district === savedDistrict)
      )?.division ??
      '';
    setDivision(savedDivision);
    setDistrict(savedDistrict);
    setUpazila(address.upazila_thana ?? '');
  };

  const saveAddress = async () => {
    try {
      await customerApi.createAddress({
        address_line: deliveryAddress.trim(),
        mobile: phoneNumber.trim() ? Number(phoneNumber.trim()) : null,
        pincode: postCode.trim(),
        division,
        district,
        upazila_thana: upazila,
        country: 'Bangladesh',
      });
      await queryClient.invalidateQueries({ queryKey: ['customer', 'addresses', userId] });
      setNotice('ঠিকানা সংরক্ষণ হয়েছে।');
    } catch (error) {
      setNotice(errorMessage(error, 'ঠিকানা সংরক্ষণ করা যায়নি।'));
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between border-b border-line bg-card px-4 py-3">
        <View className="flex-row items-center">
          <Text className="text-[18px] font-bold text-ink">শপিং কার্ট</Text>
          <View className="ml-2 rounded-full bg-primary-light px-2 py-0.5">
            <Text className="text-[11px] font-bold text-primary">{toBengaliNumber(totalQuantity)} টি</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/(ecommerce)/(tabs)/profile')} className="flex-row items-center">
          <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
          <Text className="ml-1 text-[12px] font-semibold text-primary">প্রোফাইল</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        {cartQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-3 text-[12px] text-muted">কার্ট লোড হচ্ছে...</Text>
          </View>
        ) : cartQuery.isError ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-[13px] text-red-700">{errorMessage(cartQuery.error, 'কার্ট লোড করা যায়নি।')}</Text>
            <TouchableOpacity onPress={() => void cartQuery.refetch()} className="mt-3 rounded-xl bg-primary px-4 py-2">
              <Text className="font-bold text-white">আবার চেষ্টা করুন</Text>
            </TouchableOpacity>
          </View>
        ) : cartItems.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="cart-outline" size={54} color={colors.primary} />
            <Text className="mt-3 text-[17px] font-bold text-ink">আপনার কার্ট খালি</Text>
            <Text className="mt-1 text-center text-[12px] text-muted">পছন্দের পণ্য যোগ করে অর্ডার সম্পন্ন করুন।</Text>
            <TouchableOpacity onPress={() => router.push('/(ecommerce)/(tabs)/shop')} className="mt-5 rounded-xl bg-primary px-6 py-3">
              <Text className="text-[13px] font-bold text-white">কেনাকাটা শুরু করুন</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
            <Text className="mb-2 text-[14px] font-bold text-ink">কার্টের পণ্যসমূহ</Text>
            {cartItems.map((item) => (
              <View key={`${item.id}-${item.selectedSize ?? ''}-${item.selectedColor ?? ''}`} className="mb-2.5 flex-row items-center rounded-2xl border border-line bg-card p-3">
                <View className="mr-3 h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-primary-light">
                  {isRemoteImage(item.image) ? (
                    <Image source={{ uri: item.image }} resizeMode="cover" className="h-full w-full" />
                  ) : <Text className="text-[28px]">{item.image}</Text>}
                </View>
                <View className="flex-1">
                  <Text numberOfLines={2} className="text-[12px] font-bold text-ink">{item.name}</Text>
                  <Text className="mt-1 text-[13px] font-bold text-primary">{formatTaka(item.price)}</Text>
                  <View className="mt-2 flex-row items-center self-start rounded-lg border border-line px-1">
                    <TouchableOpacity
                      disabled={item.quantity <= 1 || updateCartMutation.isPending}
                      onPress={() => updateCartMutation.mutate({
                        userId: userId!,
                        productId: item.id,
                        quantity: item.quantity - 1,
                        size: item.selectedSize,
                        color: item.selectedColor,
                      })}
                      className="h-7 w-7 items-center justify-center"
                    >
                      <Text className="text-[16px] text-ink">−</Text>
                    </TouchableOpacity>
                    <Text className="px-2 text-[12px] font-bold text-ink">{toBengaliNumber(item.quantity)}</Text>
                    <TouchableOpacity
                      disabled={updateCartMutation.isPending}
                      onPress={() => updateCartMutation.mutate({
                        userId: userId!,
                        productId: item.id,
                        quantity: item.quantity + 1,
                        size: item.selectedSize,
                        color: item.selectedColor,
                      })}
                      className="h-7 w-7 items-center justify-center"
                    >
                      <Text className="text-[16px] text-ink">＋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeCartMutation.mutate(item.id)} className="p-2">
                  <Ionicons name="trash-outline" size={19} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ))}

            <Text className="mb-2 mt-3 text-[14px] font-bold text-ink">ডেলিভারি ঠিকানা</Text>
            {addressesQuery.isError ? (
              <TouchableOpacity onPress={() => void addressesQuery.refetch()} className="mb-2">
                <Text className="text-[11px] text-red-700">সংরক্ষিত ঠিকানা লোড হয়নি: {addressesQuery.error.message} · আবার চেষ্টা</Text>
              </TouchableOpacity>
            ) : null}
            {(addressesQuery.data ?? []).length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 max-h-14">
                {(addressesQuery.data ?? []).map((address) => (
                  <TouchableOpacity key={address._id} onPress={() => handleSelectAddress(address)} className="mr-2 rounded-xl border border-line bg-white px-3 py-2">
                    <Text className="text-[11px] font-bold text-ink">{address.district ?? 'সংরক্ষিত ঠিকানা'}</Text>
                    <Text numberOfLines={1} className="mt-0.5 max-w-56 text-[10px] text-muted">{address.address_line}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
            <View className="rounded-2xl border border-line bg-card p-3.5">
              {[
                { label: 'আপনার নাম', value: customerName, setter: setCustomerName, keyboardType: 'default' as const },
                { label: 'মোবাইল নম্বর', value: phoneNumber, setter: setPhoneNumber, keyboardType: 'phone-pad' as const },
                { label: 'সম্পূর্ণ ঠিকানা', value: deliveryAddress, setter: setDeliveryAddress, keyboardType: 'default' as const },
                { label: 'পোস্ট কোড', value: postCode, setter: setPostCode, keyboardType: 'number-pad' as const },
              ].map((field) => (
                <View key={field.label} className="mb-2">
                  <Text className="mb-1 text-[11px] font-semibold text-ink">{field.label} *</Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.setter}
                    placeholder={field.label}
                    placeholderTextColor={colors.muted}
                    keyboardType={field.keyboardType}
                    className="rounded-xl border border-line bg-bg px-3 py-2.5 text-[13px] text-ink"
                  />
                </View>
              ))}
              <View className="mb-2">
                <Text className="mb-1 text-[11px] font-semibold text-ink">অ্যাকাউন্ট ইমেইল</Text>
                <View className="rounded-xl border border-line bg-line/30 px-3 py-2.5">
                  <Text className="text-[13px] text-muted">{user?.email || 'লগইন করা অ্যাকাউন্টে ইমেইল নেই'}</Text>
                </View>
                <Text className="mt-1 text-[10px] text-muted">অর্ডারের ইমেইল লগইন করা অ্যাকাউন্ট থেকে সার্ভার পাবে।</Text>
              </View>
              {([
                ['division', 'বিভাগ'],
                ['district', 'জেলা'],
                ['upazila', 'থানা / উপজেলা'],
              ] as const).map(([field, label]) => {
                const value = field === 'division' ? division : field === 'district' ? district : upazila;
                const disabled =
                  (field === 'district' && !division) ||
                  (field === 'upazila' && !district);
                return (
                  <View key={field} className="mb-2">
                    <Text className="mb-1 text-[11px] font-semibold text-ink">{label} *</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${label} নির্বাচন করুন`}
                      disabled={disabled}
                      onPress={() => {
                        setLocationSearch('');
                        setLocationPicker(field);
                      }}
                      className={`flex-row items-center justify-between rounded-xl border border-line px-3 py-3 ${disabled ? 'bg-line/40' : 'bg-bg'}`}
                    >
                      <Text className={`text-[13px] ${value ? 'text-ink' : 'text-muted'}`}>
                        {value || `${label} নির্বাচন করুন`}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              <TouchableOpacity onPress={() => void saveAddress()} className="self-start rounded-lg bg-primary-light px-3 py-2">
                <Text className="text-[11px] font-bold text-primary">ঠিকানা সংরক্ষণ করুন</Text>
              </TouchableOpacity>
            </View>

            <Text className="mb-2 mt-4 text-[14px] font-bold text-ink">পেমেন্ট</Text>
            <View className="rounded-2xl border border-line bg-card p-3">
              <View className="mb-2 flex-row">
                {([
                  ['bkash', 'বিকাশ'],
                  ['nagad', 'নগদ'],
                ] as const).map(([method, label]) => (
                  <TouchableOpacity
                    key={method}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: paymentMethod === method }}
                    onPress={() => setPaymentMethod(method)}
                    className={`mr-2 flex-1 flex-row items-center justify-center rounded-xl border px-3 py-3 ${paymentMethod === method ? 'border-primary bg-primary-light' : 'border-line bg-bg'}`}
                  >
                    <Ionicons name={paymentMethod === method ? 'radio-button-on' : 'radio-button-off'} size={18} color={paymentMethod === method ? colors.primary : colors.muted} />
                    <Text className="ml-2 text-[12px] font-semibold text-ink">{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="mb-2 text-[11px] text-muted">পেমেন্ট করা নম্বর ও ট্রানজ্যাকশন আইডি দিন</Text>
              <TextInput value={paymentPhone} onChangeText={setPaymentPhone} placeholder="যে নম্বর থেকে পেমেন্ট করেছেন" keyboardType="phone-pad" className="mb-2 rounded-xl border border-line bg-bg px-3 py-2.5 text-[12px] text-ink" />
              <TextInput value={transactionId} onChangeText={setTransactionId} placeholder="ট্রানজেকশন আইডি" autoCapitalize="characters" className="rounded-xl border border-line bg-bg px-3 py-2.5 text-[12px] text-ink" />
            </View>

            <View className="mt-3 rounded-2xl border border-line bg-card p-3.5">
              <Text className="mb-2 text-[13px] font-bold text-ink">কুপন কোড</Text>
              <View className="flex-row">
                <TextInput
                  value={couponCode}
                  onChangeText={(value) => {
                    setCouponCode(value);
                    if (appliedCouponCode) {
                      setAppliedCouponCode(null);
                      setAppliedCouponCartKey('');
                      setDiscountAmount(0);
                    }
                  }}
                  placeholder="কুপন লিখুন"
                  autoCapitalize="characters"
                  className="mr-2 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-[12px] text-ink"
                />
                <TouchableOpacity disabled={!couponCode.trim() || applyCouponMutation.isPending} onPress={() => applyCouponMutation.mutate(couponCode.trim())} className="items-center justify-center rounded-xl bg-primary px-4">
                  <Text className="text-[11px] font-bold text-white">{applyCouponMutation.isPending ? 'যাচাই...' : 'প্রয়োগ'}</Text>
                </TouchableOpacity>
              </View>
              {couponNeedsRecheck ? <Text className="mt-2 text-[11px] text-primary">কার্ট পরিবর্তন হয়েছে। কুপনটি আবার যাচাই করুন।</Text> : notice ? <Text className="mt-2 text-[11px] text-primary">{notice}</Text> : null}
              <TextInput value={orderNote} onChangeText={setOrderNote} placeholder="অর্ডার সম্পর্কে কোনো নোট (ঐচ্ছিক)" multiline className="mt-2 rounded-xl border border-line bg-bg px-3 py-2 text-[12px] text-ink" />
            </View>

            <View className="mt-3 rounded-2xl border border-line bg-card p-3.5">
              {[
                ['পণ্যের মূল্য', subtotal],
                ['ডেলিভারি চার্জ', deliveryCharge],
                ['ছাড়', formatTaka(activeDiscountAmount)],
              ].map(([label, amount]) => (
                <View key={label as string} className="mb-2 flex-row justify-between">
                  <Text className="text-[12px] text-muted">{label}</Text>
                  <Text className="text-[12px] font-semibold text-ink">{typeof amount === 'number' ? formatTaka(amount) : amount}</Text>
                </View>
              ))}
              <View className="flex-row justify-between border-t border-line pt-2">
                <Text className="text-[14px] font-bold text-ink">সর্বমোট (ডেলিভারিসহ)</Text>
                <Text className="text-[16px] font-extrabold text-primary">{formatTaka(grandTotal)}</Text>
              </View>
            </View>

            <View className="mt-4 flex-row">
              <TouchableOpacity
                onPress={() => checkoutMutation.mutate('delivery')}
                disabled={checkoutMutation.isPending}
                className={`mr-2 flex-1 items-center justify-center rounded-2xl px-2 py-3.5 ${checkoutMutation.isPending ? 'bg-primary/60' : 'bg-primary'}`}
              >
                {checkoutMutation.isPending && checkoutMutation.variables === 'delivery' ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-center text-[13px] font-bold text-white">ডেলিভারি চার্জ দিন{"\n"}{formatTaka(deliveryCharge)}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => checkoutMutation.mutate('full')}
                disabled={checkoutMutation.isPending}
                className={`flex-1 items-center justify-center rounded-2xl px-2 py-3.5 ${checkoutMutation.isPending ? 'opacity-60' : ''}`}
                style={{ backgroundColor: colors.success }}
              >
                {checkoutMutation.isPending && checkoutMutation.variables === 'full' ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-center text-[13px] font-bold text-white">সম্পূর্ণ পেমেন্ট দিন{"\n"}{formatTaka(grandTotal)}</Text>}
              </TouchableOpacity>
            </View>
            {checkoutMutation.isError ? <Text className="mt-2 text-center text-[11px] text-red-700">{errorMessage(checkoutMutation.error, 'চেকআউট সম্পন্ন হয়নি।')}</Text> : null}
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
                {locationPicker === 'division' ? 'বিভাগ নির্বাচন করুন' :
                  locationPicker === 'district' ? 'জেলা নির্বাচন করুন' : 'থানা / উপজেলা নির্বাচন করুন'}
              </Text>
              <TouchableOpacity onPress={() => setLocationPicker(null)} className="p-1">
                <Ionicons name="close" size={23} color={colors.ink} />
              </TouchableOpacity>
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
                <TouchableOpacity
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
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default CartScreen;
