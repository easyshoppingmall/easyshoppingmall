import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../../shared/components/Header';
import { SearchBar } from '../../../shared/components/SearchBar';
import { CategoryChip } from '../../../shared/components/CategoryItem';
import { ProductCard } from '../../../shared/components/ProductCard';
import { ProductGridSkeleton } from '../../../shared/components/ProductGridSkeleton';
import { ShopPagination } from '../../../shared/components/ShopPagination';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import {
  getImageSearchProducts,
} from '../api/homeApi';
import {
  SHOP_PAGE_SIZE,
  useCategoriesQuery,
  useShopProductsQuery,
  useSubcategoriesQuery,
} from '../api/queries';
import type { Product } from '../data/catalog';
import { matchesProductSearch, sortProducts, toBengaliNumber } from '../data/catalog';

type SortOption = 'discount' | 'price-low' | 'price-high' | 'rating';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'discount', label: 'সেরা অফার' },
  { value: 'price-low', label: 'কম দাম' },
  { value: 'price-high', label: 'বেশি দাম' },
  { value: 'rating', label: 'রেটিং' },
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface ShopCatalogProps {
  routeCategoryId?: string;
  routeSubcategoryId?: string;
  routeSearch: string;
}

const ShopCatalog: React.FC<ShopCatalogProps> = ({
  routeCategoryId,
  routeSubcategoryId,
  routeSearch,
}) => {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(routeCategoryId);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(
    routeSubcategoryId
  );
  const [searchQuery, setSearchQuery] = useState(routeSearch);
  const [appliedSearch, setAppliedSearch] = useState(routeSearch);
  const [sortBy, setSortBy] = useState<SortOption>('discount');
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [imageSearchUri, setImageSearchUri] = useState<string>();
  const imageSearchMutation = useMutation({ mutationFn: getImageSearchProducts });

  const categoriesQuery = useCategoriesQuery();
  const subcategoriesQuery = useSubcategoriesQuery();
  const productsQuery = useShopProductsQuery(
    {
      categoryId: selectedCategoryId,
      subCategoryId: selectedSubcategoryId,
      search: selectedSubcategoryId ? undefined : appliedSearch,
      sortBy,
    },
    currentPageNumber,
    !imageSearchUri
  );

  const products = useMemo(
    () => {
      const loadedProducts = imageSearchUri
        ? (imageSearchMutation.data ?? []).slice(0, SHOP_PAGE_SIZE)
        : productsQuery.data?.products ?? [];
      const filteredProducts =
        selectedSubcategoryId && appliedSearch
          ? loadedProducts.filter((product) => matchesProductSearch(product, appliedSearch))
          : loadedProducts;
      const uniqueProducts = new Map<string, Product>();
      for (const product of filteredProducts) {
        if (!uniqueProducts.has(product.id)) uniqueProducts.set(product.id, product);
      }
      return sortProducts([...uniqueProducts.values()], sortBy);
    },
    [
      appliedSearch,
      imageSearchMutation.data,
      imageSearchUri,
      productsQuery.data,
      selectedSubcategoryId,
      sortBy,
    ]
  );
  const currentPage = imageSearchUri ? undefined : productsQuery.data;
  const selectedCategory = categoriesQuery.data?.find(
    (category) => category.id === selectedCategoryId
  );
  const visibleSubcategories = useMemo(
    () =>
      (subcategoriesQuery.data ?? []).filter(
        (subcategory) => subcategory.categoryId === selectedCategoryId
      ),
    [selectedCategoryId, subcategoriesQuery.data]
  );

  const handleProductPress = (product: Product) => {
    router.push({ pathname: '/(ecommerce)/product/[id]', params: { id: product.id } });
  };

  const handleCategorySelect = (categoryId?: string) => {
    imageSearchMutation.reset();
    setImageSearchUri(undefined);
    setCurrentPageNumber(1);
    setAppliedSearch(searchQuery.trim());
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId(undefined);
  };

  useEffect(() => {
    const normalizedSearch = searchQuery.trim();
    if (normalizedSearch === appliedSearch) return;
    const timeout = setTimeout(() => {
      setAppliedSearch(normalizedSearch);
      setImageSearchUri(undefined);
      setCurrentPageNumber(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchQuery, appliedSearch]);

  const handleNextPage = async () => {
    if (
      imageSearchUri ||
      productsQuery.isPlaceholderData ||
      !currentPage ||
      currentPageNumber >= currentPage.totalPages
    ) return;
    setCurrentPageNumber((page) => page + 1);
  };

  const handlePreviousPage = () => {
    if (productsQuery.isPlaceholderData || currentPageNumber <= 1) return;
    setCurrentPageNumber((page) => Math.max(1, page - 1));
  };

  const retryProducts = () => void productsQuery.refetch();
  const chooseImageForSearch = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('অনুমতি প্রয়োজন', 'ছবি দিয়ে পণ্য খুঁজতে ফটো লাইব্রেরির অনুমতি দিন।');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      setImageSearchUri(result.assets[0].uri);
      imageSearchMutation.mutate(result.assets[0].uri);
    } catch (error) {
      Alert.alert('ছবি নির্বাচন করা যায়নি', error instanceof Error ? error.message : 'আবার চেষ্টা করুন।');
    }
  };

  const listHeader = (
    <View>
      <Header
        title="শপ"
        onProfilePress={() => router.push('/(ecommerce)/(tabs)/profile')}
        onCartPress={() => router.push('/(ecommerce)/(tabs)/cart')}
      />
      <SearchBar
        placeholder="পণ্য খুঁজুন"
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={() => {
          imageSearchMutation.reset();
          setImageSearchUri(undefined);
          setCurrentPageNumber(1);
          setAppliedSearch(searchQuery.trim());
        }}
        actionIcon="filter"
        onActionPress={() => setShowFilterOptions((visible) => !visible)}
        isFilterActive={showFilterOptions || sortBy !== 'discount'}
      />
      <TouchableOpacity
        onPress={() => void chooseImageForSearch()}
        disabled={imageSearchMutation.isPending}
        className="mb-2 flex-row items-center self-start rounded-xl border border-line bg-white px-3 py-2"
      >
        {imageSearchMutation.isPending ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="camera-outline" size={17} color={colors.primary} />
        )}
        <Text className="ml-2 text-[11px] font-semibold text-primary">
          {imageSearchMutation.isPending ? 'ছবি দিয়ে খোঁজা হচ্ছে...' : 'ছবি দিয়ে পণ্য খুঁজুন'}
        </Text>
      </TouchableOpacity>
      {imageSearchUri ? (
        <View className="mb-2 flex-row items-center">
          <Image source={{ uri: imageSearchUri }} className="h-10 w-10 rounded-lg" />
          <Text className="ml-2 flex-1 text-[10px] text-muted">
            {imageSearchMutation.isError ? imageSearchMutation.error.message : `${toBengaliNumber(imageSearchMutation.data?.length ?? 0)}টি মিল পাওয়া গেছে`}
          </Text>
          <TouchableOpacity onPress={() => { imageSearchMutation.reset(); setImageSearchUri(undefined); }}>
            <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {showFilterOptions ? (
        <View className="mb-2.5 rounded-xl border border-line bg-card p-2.5">
          <Text className="mb-2 text-[11px] font-semibold text-ink">সাজান</Text>
          <View className="flex-row flex-wrap">
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  imageSearchMutation.reset();
                  setImageSearchUri(undefined);
                  setCurrentPageNumber(1);
                  setAppliedSearch(searchQuery.trim());
                  setSortBy(option.value);
                }}
                className={`mb-1.5 mr-1.5 rounded-full border px-3 py-1.5 ${
                  sortBy === option.value
                    ? 'border-primary bg-primary-light'
                    : 'border-line bg-white'
                }`}
              >
                <Text
                  className={`text-[11px] ${
                    sortBy === option.value ? 'font-bold text-primary' : 'text-muted'
                  }`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {categoriesQuery.isError ? (
        <View className="mb-2 flex-row items-center justify-between rounded-xl bg-red-50 px-3 py-2">
          <Text className="mr-2 flex-1 text-[11px] text-red-700">
            ক্যাটাগরি লোড করা যায়নি: {categoriesQuery.error.message}
          </Text>
          <TouchableOpacity onPress={() => void categoriesQuery.refetch()}>
            <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {categoriesQuery.isLoading ? (
        <View className="h-10 items-center justify-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View className="mb-2">
          <FlatList
            horizontal
            data={categoriesQuery.data ?? []}
            keyExtractor={(category) => category.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
            ListHeaderComponent={
              <CategoryChip
                categoryName="সব"
                isSelected={!selectedCategoryId}
                onPress={() => handleCategorySelect()}
              />
            }
            renderItem={({ item: category }) => (
              <CategoryChip
                categoryName={category.name}
                isSelected={selectedCategoryId === category.id}
                onPress={() => handleCategorySelect(category.id)}
              />
            )}
          />
        </View>
      )}

      {selectedCategoryId && visibleSubcategories.length ? (
        <View className="mb-2">
          <FlatList
            horizontal
            data={visibleSubcategories}
            keyExtractor={(subcategory) => subcategory.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
            ListHeaderComponent={
              <CategoryChip
                categoryName="সব সাব-ক্যাটাগরি"
                isSelected={!selectedSubcategoryId}
                onPress={() => {
                  imageSearchMutation.reset();
                  setImageSearchUri(undefined);
                  setCurrentPageNumber(1);
                  setAppliedSearch(searchQuery.trim());
                  setSelectedSubcategoryId(undefined);
                }}
              />
            }
            renderItem={({ item: subcategory }) => (
              <CategoryChip
                categoryName={subcategory.name}
                isSelected={selectedSubcategoryId === subcategory.id}
                onPress={() => {
                  imageSearchMutation.reset();
                  setImageSearchUri(undefined);
                  setCurrentPageNumber(1);
                  setAppliedSearch(searchQuery.trim());
                  setSelectedSubcategoryId(subcategory.id);
                }}
              />
            )}
          />
        </View>
      ) : null}

      {subcategoriesQuery.isError ? (
        <View className="mb-2 flex-row items-center justify-between rounded-xl bg-red-50 px-3 py-2">
          <Text className="mr-2 flex-1 text-[11px] text-red-700">
            সাব-ক্যাটাগরি লোড করা যায়নি: {subcategoriesQuery.error.message}
          </Text>
          <TouchableOpacity onPress={() => void subcategoriesQuery.refetch()}>
            <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[12px] text-muted">
          {toBengaliNumber(products.length)}টি পণ্য দেখানো হচ্ছে
          {!imageSearchUri && currentPage?.totalCount !== undefined
            ? ` / ${toBengaliNumber(currentPage.totalCount)}টি`
            : ''}
          {selectedCategory ? ` · ${selectedCategory.name}` : ''}
        </Text>
        {selectedCategoryId || selectedSubcategoryId || appliedSearch ? (
          <TouchableOpacity
            onPress={() => {
              handleCategorySelect();
              setSearchQuery('');
              setAppliedSearch('');
              setCurrentPageNumber(1);
            }}
          >
            <Text className="text-[11px] font-semibold text-primary">রিসেট করুন</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <FlatList
        key="dynamic-shop-products"
        className="flex-1"
        data={products}
        keyExtractor={(product) => product.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{
          alignItems: 'stretch',
          justifyContent: 'space-between',
        }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={40}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={imageSearchUri
              ? imageSearchMutation.isPending
              : productsQuery.isRefetching && !productsQuery.isPlaceholderData}
            onRefresh={() => {
              if (imageSearchUri) imageSearchMutation.mutate(imageSearchUri);
              else retryProducts();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <View className="w-[48%]">
            <ProductCard product={item} grid onPress={handleProductPress} />
          </View>
        )}
        ListEmptyComponent={
          imageSearchUri
            ? imageSearchMutation.isPending ? (
              <View className="pt-2">
                <ProductGridSkeleton />
              </View>
            ) : imageSearchMutation.isError ? (
              <View className="items-center px-4 py-12">
                <Text className="text-center text-[13px] text-red-700">
                  {imageSearchMutation.error.message}
                </Text>
                <TouchableOpacity
                  onPress={() => imageSearchMutation.mutate(imageSearchUri)}
                  className="mt-3 rounded-xl bg-primary px-4 py-2"
                >
                  <Text className="text-[12px] font-bold text-white">আবার চেষ্টা করুন</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="items-center py-16">
                <Text className="mb-2 text-[32px]">🔍</Text>
                <Text className="text-[15px] font-bold text-ink">কোনো পণ্য পাওয়া যায়নি</Text>
                <Text className="mt-1 px-8 text-center text-[12px] text-muted">
                  অন্য ছবি দিয়ে আবার চেষ্টা করুন
                </Text>
              </View>
            )
            : productsQuery.isPending ? (
              <View className="pt-2">
                <ProductGridSkeleton />
              </View>
            ) : productsQuery.isError ? (
              <View className="items-center px-4 py-12">
              <Text className="text-center text-[13px] text-red-700">
                  {productsQuery.error.message}
              </Text>
                <TouchableOpacity
                  onPress={retryProducts}
                  className="mt-3 rounded-xl bg-primary px-4 py-2"
                >
                <Text className="text-[12px] font-bold text-white">আবার চেষ্টা করুন</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center py-16">
              <Text className="mb-2 text-[32px]">🔍</Text>
              <Text className="text-[15px] font-bold text-ink">কোনো পণ্য পাওয়া যায়নি</Text>
              <Text className="mt-1 px-8 text-center text-[12px] text-muted">
                {selectedSubcategoryId &&
                appliedSearch &&
                currentPageNumber < (currentPage?.totalPages ?? currentPageNumber)
                  ? 'এই পাতায় মেলেনি। পরের পাতায় আরও পণ্য খুঁজুন।'
                  : 'অন্য নামে খুঁজুন অথবা ক্যাটাগরি ফিল্টার পরিবর্তন করুন'}
              </Text>
            </View>
          )
        }
      />
      {!imageSearchUri && currentPage ? (
        <View className="px-3 pb-2 pt-1">
          {productsQuery.isError ? (
            <View className="mb-2 flex-row items-center justify-between rounded-xl bg-red-50 px-3 py-2">
              <Text className="mr-2 flex-1 text-[11px] text-red-700">
                পণ্য আপডেট করা যায়নি: {productsQuery.error.message}
              </Text>
              <TouchableOpacity onPress={retryProducts}>
                <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {currentPage.totalPages > 1 ? (
            <ShopPagination
              currentPage={
                productsQuery.isPlaceholderData ? currentPage.page : currentPageNumber
              }
              totalPages={currentPage.totalPages}
              hasPrevious={!productsQuery.isPlaceholderData && currentPageNumber > 1}
              hasNext={
                !productsQuery.isPlaceholderData &&
                currentPageNumber < currentPage.totalPages
              }
              isChangingPage={productsQuery.isPlaceholderData}
              isLoadingPage={
                (productsQuery.isPlaceholderData && productsQuery.isFetching) ||
                (productsQuery.isFetching && currentPage.page !== currentPageNumber)
              }
              onPrevious={handlePreviousPage}
              onNext={() => void handleNextPage()}
            />
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
};

export const ShopScreen: React.FC = () => {
  const params = useLocalSearchParams<{
    selectedCategoryId?: string | string[];
    selectedSubcategoryId?: string | string[];
    search?: string | string[];
  }>();
  const routeCategoryId = firstParam(params.selectedCategoryId);
  const routeSubcategoryId = firstParam(params.selectedSubcategoryId);
  const routeSearch = firstParam(params.search) ?? '';
  return (
    <ShopCatalog
      key={`${routeCategoryId ?? ''}:${routeSubcategoryId ?? ''}:${routeSearch}`}
      routeCategoryId={routeCategoryId}
      routeSubcategoryId={routeSubcategoryId}
      routeSearch={routeSearch}
    />
  );
};

export default ShopScreen;
