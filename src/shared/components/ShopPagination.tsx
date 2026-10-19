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
    <View className="mt-2 rounded-2xl border border-line bg-white px-3 py-3">
      <Text className="mb-3 text-center text-[11px] font-medium text-muted">
        পৃষ্ঠা {toBengaliNumber(currentPage)} / {toBengaliNumber(totalPages)}
      </Text>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasPrevious || isChangingPage }}
          disabled={!hasPrevious || isChangingPage}
          onPress={onPrevious}
          activeOpacity={0.75}
          className={`h-10 flex-1 flex-row items-center justify-center rounded-xl border ${
            hasPrevious ? 'border-line bg-white' : 'border-line bg-slate-50'
          }`}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={hasPrevious ? colors.primary : colors.muted}
          />
          <Text
            className={`ml-1 text-[12px] font-semibold ${
              hasPrevious ? 'text-primary' : 'text-muted'
            }`}
          >
            Previous
          </Text>
        </TouchableOpacity>
        <View className="w-3" />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasNext || isChangingPage }}
          disabled={!hasNext || isChangingPage}
          onPress={onNext}
          activeOpacity={0.75}
          className={`h-10 flex-1 flex-row items-center justify-center rounded-xl ${
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
              <Text className="mr-1 text-[12px] font-semibold text-white">Next</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default ShopPagination;
