import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { toBengaliNumber } from '../../features/ecommerce/data/catalog';

interface ShopPaginationProps {
  currentPage: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  isChangingPage: boolean;
  isLoadingPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function ShopPagination({
  currentPage,
  totalPages,
  hasPrevious,
  hasNext,
  isChangingPage,
  isLoadingPage,
  onPrevious,
  onNext,
}: ShopPaginationProps) {
  return (
    <View className="self-center rounded-2xl border border-[#D9EFFC] bg-white px-2.5 py-2">
      <View className="flex-row items-center">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasPrevious || isChangingPage }}
          disabled={!hasPrevious || isChangingPage}
          onPress={onPrevious}
          activeOpacity={0.75}
          className={`h-8 flex-row items-center justify-center rounded-lg border px-2 ${
            hasPrevious ? 'border-line bg-white' : 'border-line bg-slate-50'
          }`}
        >
          <Ionicons
            name="chevron-back"
            size={14}
            color={hasPrevious ? colors.primary : colors.muted}
          />
          <Text
            className={`ml-0.5 text-[10px] font-semibold ${
              hasPrevious ? 'text-primary' : 'text-muted'
            }`}
          >
            আগের
          </Text>
        </TouchableOpacity>
        <View className="mx-2 min-w-[76px] items-center">
          <Text className="text-[10px] font-bold text-ink">
            {toBengaliNumber(currentPage)} / {toBengaliNumber(totalPages)}
          </Text>
          <Text className="text-[8px] text-muted">পৃষ্ঠা</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasNext || isChangingPage }}
          disabled={!hasNext || isChangingPage}
          onPress={onNext}
          activeOpacity={0.75}
          className={`h-8 flex-row items-center justify-center rounded-lg px-2 ${
            hasNext ? 'bg-primary' : 'bg-slate-300'
          }`}
        >
          {isLoadingPage ? (
            <ActivityIndicator
              accessibilityLabel="পৃষ্ঠা লোড হচ্ছে"
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <>
              <Text className="mr-0.5 text-[10px] font-semibold text-white">পরের</Text>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default ShopPagination;
