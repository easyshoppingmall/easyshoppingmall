import React from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { isRemoteImage, Product, formatTaka } from '../../features/ecommerce/data/catalog';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addToCart } from '../../store/cartSlice';
import { colors } from '../theme/colors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi, responseMessage } from '../../features/ecommerce/api/customerApi';

interface ProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
  horizontal?: boolean;
  grid?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  horizontal = false,
  grid = false,
}) => {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?._id);
  const queryClient = useQueryClient();
  const addCartMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('কার্টে যোগ করার আগে লগইন করুন।');
      await customerApi.addCartItem({ userId, productId: product.id, quantity: 1 });
    },
    onSuccess: () => {
      dispatch(
        addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image,
          category: product.category,
        })
      );
      void queryClient.invalidateQueries({ queryKey: ['customer', 'cart', userId] });
      Alert.alert('কার্টে যোগ হয়েছে', `"${product.name}" কার্টে যুক্ত হয়েছে।`, [
        { text: 'ঠিক আছে' },
      ]);
    },
    onError: (error) =>
      Alert.alert('কার্টে যোগ হয়নি', responseMessage(error, 'আবার চেষ্টা করুন।')),
  });

  const handleAddToCart = () => {
    if (userId) {
      addCartMutation.mutate();
      return;
    }
    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        category: product.category,
      })
    );
    Alert.alert('কার্টে যোগ হয়েছে', `"${product.name}" কার্টে যুক্ত হয়েছে।`, [
      { text: 'ঠিক আছে' },
    ]);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(product)}
      className={`bg-card border border-line rounded-[14px] p-2 relative mb-2.5 ${
        horizontal
          ? 'mx-1.5 w-[158px] flex-none'
          : grid
            ? 'h-[218px] w-full'
            : 'mx-1.5 flex-1'
      }`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      {/* Discount Badge */}
      {product.discount && (
        <View className="absolute top-2 left-2 z-10 bg-accent rounded-[6px] px-1.5 py-0.5">
          <Text className="text-white text-[10px] font-bold">
            {product.discount}
          </Text>
        </View>
      )}

      {/* Product Image Box */}
      <View
        className="h-[112px] rounded-[10px] items-center justify-center mb-1.5 overflow-hidden"
        style={{ backgroundColor: product.bgColor || colors.tintBlue }}
      >
        {isRemoteImage(product.image) ? (
          <Image
            source={{ uri: product.image }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={product.id}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Text className="text-[32px]">{product.image}</Text>
        )}
      </View>

      {/* Product Name */}
      <Text
        numberOfLines={2}
        className="text-[12px] text-ink font-medium leading-[16px] h-[32px]"
      >
        {product.name}
      </Text>

      {/* Price & Add Button Row */}
      <View className="flex-row items-center justify-between mt-1">
        <View className="flex-row items-baseline flex-wrap flex-1 pr-1">
          <Text
            className="text-[14px] font-bold"
            style={{ color: colors.primaryDark }}
          >
            {formatTaka(product.price)}
          </Text>
          {product.originalPrice && (
            <Text className="text-muted text-[10px] line-through ml-1">
              {formatTaka(product.originalPrice)}
            </Text>
          )}
        </View>

        {/* Add Button */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleAddToCart}
          disabled={addCartMutation.isPending}
          className="w-[26px] h-[26px] rounded-[8px] bg-primary items-center justify-center"
        >
          {addCartMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="add" size={17} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default ProductCard;
