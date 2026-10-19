import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  formatDropshippingTaka,
  type DropshippingProduct,
} from '../api/homeApi';

interface DropshippingProductCardProps {
  product: DropshippingProduct;
  onPress: () => void;
}

export function DropshippingProductCard({
  product,
  onPress,
}: DropshippingProductCardProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.88}
      className="mr-3 w-[154px] overflow-hidden rounded-2xl border border-line bg-white"
      style={{
        shadowColor: '#12263A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="h-[112px] items-center justify-center overflow-hidden bg-primary-light">
        {product.image ? (
          <Image
            source={{ uri: product.image }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={product.id}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Ionicons name="cube-outline" size={34} color="#0092EE" />
        )}
        {product.discount ? (
          <View className="absolute left-2 top-2 rounded-md bg-red-500 px-1.5 py-1">
            <Text className="text-[9px] font-bold text-white">
              {product.discount}% ছাড়
            </Text>
          </View>
        ) : null}
      </View>
      <View className="p-2.5">
        <Text numberOfLines={2} className="h-9 text-[12px] font-semibold leading-[17px] text-ink">
          {product.name}
        </Text>
        {product.brand ? (
          <Text numberOfLines={1} className="mt-0.5 text-[10px] text-muted">
            {product.brand}
          </Text>
        ) : null}
        <Text className="mt-1 text-[9px] text-muted">আপনার পণ্য খরচ</Text>
        <Text className="mt-0.5 text-[13px] font-bold text-primary-dark">
          {product.dropshippingPrice === undefined
            ? 'মূল্য পাওয়া যায়নি'
            : formatDropshippingTaka(product.dropshippingPrice)}
        </Text>
        <Text className="mt-1 text-[9px] text-muted">Product Rank / বিক্রয়মূল্য</Text>
        <Text className="text-[11px] font-semibold text-ink">
          {product.productRank === undefined
            ? 'তথ্য পাওয়া যায়নি'
            : formatDropshippingTaka(product.productRank)}
        </Text>
        {product.productRank !== undefined && product.dropshippingPrice !== undefined ? (
          <Text className={`mt-0.5 text-[9px] font-semibold ${product.productRank >= product.dropshippingPrice ? 'text-emerald-700' : 'text-red-600'}`}>
            আনুমানিক লাভ {formatDropshippingTaka(product.productRank - product.dropshippingPrice)} / পিস
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
