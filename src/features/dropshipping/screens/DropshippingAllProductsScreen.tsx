import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import {
  useDropshippingCategoriesQuery,
  useDropshippingSubcategoriesQuery,
} from '../api/queries';
import type { DropshippingCategory, DropshippingSubcategory } from '../api/homeApi';

function CatalogSkeleton() {
  return (
    <View className="px-4 pt-5">
      {[0, 1, 2].map((section) => (
        <View key={section} className="mb-7">
          <View className="mb-4 h-5 w-40 rounded-lg bg-slate-200" />
          <View className="flex-row flex-wrap">
            {[0, 1, 2, 3].map((card) => (
              <View key={card} className="mb-3 mr-2 h-[122px] w-[47%] rounded-2xl bg-slate-200" />
            ))}
          </View>
        </View>
      ))}
      <View className="items-center py-4">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="mt-2 text-[11px] text-muted">ক্যাটাগরি লোড হচ্ছে...</Text>
      </View>
    </View>
  );
}

function SubcategoryCard({
  subcategory,
  width,
  onPress,
}: {
  subcategory: DropshippingSubcategory;
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ width }}
      className="mb-3 overflow-hidden rounded-2xl border border-line bg-white"
    >
      <View className="h-[104px] items-center justify-center overflow-hidden bg-primary-light">
        {subcategory.image ? (
          <Image
            source={{ uri: subcategory.image }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={subcategory.id}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Text className="text-[30px]">{subcategory.icon || '📦'}</Text>
        )}
      </View>
      <View className="min-h-[62px] flex-row items-center justify-between px-3 py-2.5">
        <Text numberOfLines={2} className="flex-1 text-[11px] font-bold leading-4 text-ink">
          {subcategory.name}
        </Text>
        <Ionicons name="chevron-forward" size={15} color={colors.primary} />
      </View>
    </Pressable>
  );
}

function CategorySection({
  category,
  subcategories,
  cardWidth,
  onSelect,
}: {
  category: DropshippingCategory;
  subcategories: DropshippingSubcategory[];
  cardWidth: number;
  onSelect: (subcategory: DropshippingSubcategory) => void;
}) {
  return (
    <View className="mb-7">
      <View className="mb-3 flex-row items-center">
        <View className="mr-3 h-10 w-10 overflow-hidden items-center justify-center rounded-xl bg-white">
          {category.image ? (
            <Image
              source={{ uri: category.image }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={category.id}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Text className="text-[21px]">{category.icon || '🛍️'}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-[16px] font-extrabold text-ink">{category.name}</Text>
          <Text className="mt-0.5 text-[10px] text-muted">
            {subcategories.length}টি সাবক্যাটাগরি
          </Text>
        </View>
      </View>

      {subcategories.length > 0 ? (
        <View className="flex-row flex-wrap justify-between">
          {subcategories.map((subcategory) => (
            <SubcategoryCard
              key={subcategory.id}
              subcategory={subcategory}
              width={cardWidth}
              onPress={() => onSelect(subcategory)}
            />
          ))}
        </View>
      ) : (
        <View className="rounded-2xl border border-dashed border-line bg-white px-4 py-5">
          <Text className="text-center text-[11px] text-muted">
            এই ক্যাটাগরিতে এখন কোনো সক্রিয় সাবক্যাটাগরি নেই।
          </Text>
        </View>
      )}
    </View>
  );
}

export function DropshippingAllProductsScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const categoriesQuery = useDropshippingCategoriesQuery();
  const subcategoriesQuery = useDropshippingSubcategoriesQuery();
  const isLoading = categoriesQuery.isPending || subcategoriesQuery.isPending;
  const hasError = categoriesQuery.isError || subcategoriesQuery.isError;
  const contentWidth = Math.min(Math.max(screenWidth - 32, 0), 1120);
  const columns = contentWidth >= 900 ? 5 : contentWidth >= 560 ? 3 : 2;
  const cardWidth = (contentWidth - (columns - 1) * 10) / columns;

  const groupedSubcategories = useMemo(() => {
    const groups = new Map<string, DropshippingSubcategory[]>();
    for (const subcategory of subcategoriesQuery.data ?? []) {
      const group = groups.get(subcategory.categoryId) ?? [];
      group.push(subcategory);
      groups.set(subcategory.categoryId, group);
    }
    return groups;
  }, [subcategoriesQuery.data]);

  const retry = () => {
    void Promise.all([categoriesQuery.refetch(), subcategoriesQuery.refetch()]);
  };

  const openSubcategory = (subcategory: DropshippingSubcategory) => {
    router.push({
      pathname: '/(dropshipping)/products/[subcategory]',
      params: {
        subcategory: subcategory.id,
        categoryId: subcategory.categoryId,
        name: subcategory.name,
      },
    });
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
          onPress={() => router.replace('/(dropshipping)')}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[16px] font-extrabold text-ink">All Products</Text>
          <Text className="mt-0.5 text-[10px] text-muted">ক্যাটাগরি অনুযায়ী পণ্য দেখুন</Text>
        </View>
        {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingTop: 16, paddingBottom: 32 }}
      >
        <View style={{ width: contentWidth }}>
          <View className="mb-5 overflow-hidden rounded-[24px] bg-primary px-5 py-5">
            <View className="absolute -right-4 -top-7 h-28 w-28 rounded-full bg-white/10" />
            <View className="flex-row items-center">
              <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <Ionicons name="grid-outline" size={24} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">পণ্য ক্যাটালগ</Text>
                <Text className="mt-1 text-[11px] leading-4 text-white/85">
                  সাবক্যাটাগরি বেছে নিয়ে ড্রপশিপিং পণ্য দেখুন
                </Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <CatalogSkeleton />
          ) : hasError ? (
            <View className="items-center rounded-2xl border border-red-100 bg-white px-6 py-8">
              <Ionicons name="cloud-offline-outline" size={32} color="#DC2626" />
              <Text className="mt-3 text-center text-[13px] font-bold text-ink">
                ক্যাটাগরি লোড করা যায়নি
              </Text>
              <Text className="mt-1 text-center text-[11px] leading-5 text-muted">
                {categoriesQuery.error?.message || subcategoriesQuery.error?.message}
              </Text>
              <Pressable onPress={retry} className="mt-4 rounded-xl bg-primary px-5 py-3">
                <Text className="text-[11px] font-bold text-white">আবার চেষ্টা করুন</Text>
              </Pressable>
            </View>
          ) : (categoriesQuery.data ?? []).length === 0 ? (
            <View className="items-center rounded-2xl border border-line bg-white px-6 py-10">
              <Ionicons name="file-tray-outline" size={32} color={colors.muted} />
              <Text className="mt-3 text-[13px] font-bold text-ink">কোনো সক্রিয় ক্যাটাগরি নেই</Text>
            </View>
          ) : (
            (categoriesQuery.data ?? []).map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                subcategories={groupedSubcategories.get(category.id) ?? []}
                cardWidth={cardWidth}
                onSelect={openSubcategory}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default DropshippingAllProductsScreen;
