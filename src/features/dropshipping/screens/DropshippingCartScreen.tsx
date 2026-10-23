import { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import {
  formatDropshippingNumber,
  formatDropshippingTaka,
  roundDropshippingMoney,
} from '../api/homeApi';
import {
  removeDropshippingCartItem,
  updateDropshippingCartItem,
} from '../../../store/dropshippingCartSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';

export function DropshippingCartScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.dropshippingCart.items);
  const hasUnknownCost = items.some((item) =>
    item.product.dropshippingPrice === undefined ||
    !Number.isFinite(item.product.dropshippingPrice) ||
    item.product.dropshippingPrice <= 0
  );
  const totals = useMemo(() => items.reduce((summary, item) => {
    const cost = item.product.dropshippingPrice ?? 0;
    const sellingPrice = Number(item.sellingPrice);
    const validSellingPrice = item.sellingPrice.trim() !== '' &&
      Number.isFinite(sellingPrice) &&
      sellingPrice >= 0
      ? sellingPrice
      : 0;
    return {
      quantity: summary.quantity + item.quantity,
      cost: roundDropshippingMoney(summary.cost + roundDropshippingMoney(cost * item.quantity)),
      selling: roundDropshippingMoney(summary.selling + roundDropshippingMoney(validSellingPrice * item.quantity)),
    };
  }, { quantity: 0, cost: 0, selling: 0 }), [items]);
  const profit = hasUnknownCost
    ? undefined
    : roundDropshippingMoney(totals.selling - totals.cost);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ফিরে যান"
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[16px] font-extrabold text-ink">Dropshipping Cart</Text>
          <Text className="mt-0.5 text-[10px] text-muted">
            {formatDropshippingNumber(items.length)}টি পণ্য · {formatDropshippingNumber(totals.quantity)}টি ইউনিট
          </Text>
        </View>
      </View>

      {items.length ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 }}
        >
          <View className="w-full max-w-[760px]">
            {items.map((item) => {
              const image = item.product.images?.[0] ?? item.product.image;
              const cost = item.product.dropshippingPrice;
              const itemSellingPrice = Number(item.sellingPrice);
              const hasValidSellingPrice = item.sellingPrice.trim() !== '' &&
                Number.isFinite(itemSellingPrice) &&
                itemSellingPrice >= 0;
              const itemProfit = hasValidSellingPrice && cost !== undefined
                ? roundDropshippingMoney((itemSellingPrice - cost) * item.quantity)
                : undefined;
              const updateQuantity = (quantity: number) => {
                if (quantity <= 0) {
                  dispatch(removeDropshippingCartItem(item.key));
                } else {
                  dispatch(updateDropshippingCartItem({
                    key: item.key,
                    changes: { quantity },
                  }));
                }
              };
              return (
                <View key={item.key} className="mb-3 rounded-[22px] border border-line bg-white p-3.5">
                  <View className="flex-row">
                    {image ? (
                      <Image
                        source={{ uri: image }}
                        resizeMode="cover"
                        style={{ width: 82, height: 82, borderRadius: 14, backgroundColor: '#F3F4F6' }}
                      />
                    ) : (
                      <View className="h-[82px] w-[82px] items-center justify-center rounded-[14px] bg-primary-light">
                        <Ionicons name="image-outline" size={28} color={colors.primary} />
                      </View>
                    )}
                    <View className="ml-3 flex-1 justify-center">
                      <Text numberOfLines={2} className="text-[13px] font-bold leading-5 text-ink">
                        {item.product.name}
                      </Text>
                      <Text className="mt-1 text-[11px] font-semibold text-primary">
                        Dropshipping Price: {cost === undefined ? 'API-তে নেই' : formatDropshippingTaka(cost)}
                      </Text>
                      {item.size || item.color || item.weight ? (
                        <Text className="mt-1 text-[10px] text-muted">
                          {[item.size, item.color, item.weight].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.product.name} কার্ট থেকে সরান`}
                      onPress={() => dispatch(removeDropshippingCartItem(item.key))}
                      className="h-9 w-9 items-center justify-center rounded-full bg-red-50"
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.accent} />
                    </Pressable>
                  </View>

                  <View className="mt-4 flex-row items-end">
                    <View className="mr-3 flex-1">
                      <Text className="mb-1.5 text-[11px] font-semibold text-ink">Quantity</Text>
                      <View className="h-11 flex-row items-center justify-between rounded-xl border border-line bg-bg px-2">
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="পরিমাণ কমান"
                          onPress={() => updateQuantity(item.quantity - 1)}
                          className="h-8 w-8 items-center justify-center rounded-lg bg-white"
                        >
                          <Ionicons name="remove" size={17} color={colors.ink} />
                        </Pressable>
                        <Text className="text-[13px] font-bold text-ink">{formatDropshippingNumber(item.quantity)}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="পরিমাণ বাড়ান"
                          disabled={item.product.stockCount !== undefined && item.quantity >= item.product.stockCount}
                          onPress={() => updateQuantity(item.quantity + 1)}
                          className="h-8 w-8 items-center justify-center rounded-lg bg-white"
                        >
                          <Ionicons
                            name="add"
                            size={17}
                            color={item.product.stockCount !== undefined && item.quantity >= item.product.stockCount
                              ? colors.muted
                              : colors.ink}
                          />
                        </Pressable>
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="mb-1.5 text-[11px] font-semibold text-ink">Your Selling Price (৳)</Text>
                      <TextInput
                        accessibilityLabel={`${item.product.name} বিক্রয়মূল্য`}
                        value={item.sellingPrice}
                        onChangeText={(sellingPrice) => dispatch(updateDropshippingCartItem({
                          key: item.key,
                          changes: { sellingPrice },
                        }))}
                        keyboardType="decimal-pad"
                        placeholder="৳ মূল্য লিখুন"
                        placeholderTextColor={colors.muted}
                        className="h-11 rounded-xl border border-primary/40 bg-primary-light px-3 text-[13px] font-semibold text-ink"
                      />
                    </View>
                  </View>
                  <View className="mt-3 flex-row justify-between border-t border-line pt-3">
                    <Text className="text-[11px] text-muted">
                      মোট Dropshipping Cost: {cost === undefined
                        ? 'তথ্য নেই'
                          : formatDropshippingTaka(roundDropshippingMoney(cost * item.quantity))}
                    </Text>
                    <Text className={`text-[11px] font-bold ${itemProfit !== undefined && itemProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      লাভ: {itemProfit === undefined ? '—' : formatDropshippingTaka(itemProfit)}
                    </Text>
                  </View>
                  {item.product.stockCount !== undefined ? (
                    <Text className="mt-2 text-[10px] text-muted">
                      স্টক: {formatDropshippingNumber(item.product.stockCount)}টি
                    </Text>
                  ) : null}
                </View>
              );
            })}

            <View className="rounded-[22px] border border-line bg-white p-4">
              <Text className="mb-3 text-[14px] font-extrabold text-ink">Cart Summary</Text>
              <SummaryRow
                label="Total Dropshipping Cost"
                amount={hasUnknownCost ? undefined : totals.cost}
              />
              <SummaryRow label="Total Selling Price" amount={totals.selling} />
              <View className="mt-2 flex-row justify-between border-t border-line pt-3">
                <Text className="text-[13px] font-bold text-ink">Estimated Profit</Text>
                <Text className={`text-[14px] font-extrabold ${profit === undefined ? 'text-muted' : profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {profit === undefined ? 'তথ্য নেই' : formatDropshippingTaka(profit)}
                </Text>
              </View>
              {hasUnknownCost ? (
                <Text className="mt-2 text-[10px] leading-4 text-amber-800">
                  পণ্যের Dropshipping Cost API-তে নেই। সঠিক খরচ ছাড়া লাভের হিসাব দেখানো যাচ্ছে না।
                </Text>
              ) : null}
              <Text className="mt-2 text-[10px] leading-4 text-muted">
                Delivery charge ও coupon checkout/API-এর নিয়ম অনুযায়ী নির্ধারিত হবে।
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!items.length}
              onPress={() => router.push('/(dropshipping)/checkout')}
              className="mt-4 min-h-12 flex-row items-center justify-center rounded-2xl bg-primary px-5 py-3.5"
            >
              <Ionicons name="arrow-forward-circle-outline" size={19} color="#FFFFFF" />
              <Text className="ml-2 text-[13px] font-bold text-white">Proceed to Checkout</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-light">
            <Ionicons name="cart-outline" size={38} color={colors.primary} />
          </View>
          <Text className="mt-4 text-[16px] font-extrabold text-ink">আপনার Dropshipping Cart খালি</Text>
          <Text className="mt-2 text-center text-[11px] leading-5 text-muted">
            পণ্য থেকে “কার্টে যোগ করে Checkout” বেছে নিলে এখানে আপনার পণ্যগুলো দেখা যাবে।
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(dropshipping)/all-products')}
            className="mt-5 rounded-xl bg-primary px-5 py-3"
          >
            <Text className="text-[12px] font-bold text-white">পণ্য দেখুন</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function SummaryRow({ label, amount }: { label: string; amount?: number }) {
  return (
    <View className="mb-2 flex-row justify-between">
      <Text className="text-[11px] text-muted">{label}</Text>
      <Text className="text-[11px] font-semibold text-ink">
        {amount === undefined ? 'তথ্য নেই' : formatDropshippingTaka(amount)}
      </Text>
    </View>
  );
}
