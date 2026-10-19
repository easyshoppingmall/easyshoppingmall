import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../../shared/components/Header';
import { colors } from '../../../shared/theme/colors';
import { customerApi, type BlogArticle } from '../api/customerApi';

function articleDate(article: BlogArticle): string {
  return article.createdDateBn ?? (article.createdAt ? new Date(article.createdAt).toLocaleDateString() : '');
}

export const BlogScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('সব');
  const [selectedArticleId, setSelectedArticleId] = useState<string>();
  const postsQuery = useQuery({
    queryKey: ['customer', 'blog'],
    queryFn: customerApi.getBlogPosts,
  });
  const articleQuery = useQuery({
    queryKey: ['customer', 'blog-article', selectedArticleId],
    queryFn: () => customerApi.getBlogPost(selectedArticleId!),
    enabled: Boolean(selectedArticleId),
  });
  const posts = useMemo(() => postsQuery.data ?? [], [postsQuery.data]);
  const categories = useMemo(
    () => ['সব', ...new Set(posts.map((post) => post.category).filter((category): category is string => Boolean(category)))],
    [posts]
  );
  const filteredPosts = selectedCategory === 'সব'
    ? posts
    : posts.filter((post) => post.category === selectedCategory);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-1 px-4">
        <Header title="ব্লগ ও টিপস" subtitle="কেনাকাটা ও লাইফস্টাইল নির্দেশিকা" />
        {postsQuery.isError ? (
          <View className="flex-row items-center justify-between rounded-xl bg-red-50 px-3 py-2">
            <Text className="mr-2 flex-1 text-[12px] text-red-700">{postsQuery.error.message}</Text>
            <TouchableOpacity onPress={() => void postsQuery.refetch()}>
              <Text className="font-bold text-primary">আবার চেষ্টা</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {postsQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 max-h-10">
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  className={`mr-2 rounded-full border px-3.5 py-1.5 ${
                    selectedCategory === category ? 'border-primary bg-primary' : 'border-line bg-card'
                  }`}
                >
                  <Text className={`text-[12px] ${selectedCategory === category ? 'font-bold text-white' : 'text-ink'}`}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <FlatList
              data={filteredPosts}
              keyExtractor={(post) => post._id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 28 }}
              ListEmptyComponent={
                <View className="items-center py-16">
                  <Ionicons name="newspaper-outline" size={42} color={colors.muted} />
                  <Text className="mt-3 text-[14px] font-semibold text-ink">কোনো আর্টিকেল পাওয়া যায়নি</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedArticleId(item._id)}
                  className="mb-3 overflow-hidden rounded-2xl border border-line bg-card"
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} resizeMode="cover" className="h-44 w-full bg-primary-light" />
                  ) : null}
                  <View className="p-3.5">
                    <View className="mb-1.5 flex-row items-center justify-between">
                      <Text className="text-[10px] font-bold text-primary">{item.category ?? 'ব্লগ'}</Text>
                      <Text className="text-[10px] text-muted">{articleDate(item)}</Text>
                    </View>
                    <Text className="text-[15px] font-bold text-ink">{item.title}</Text>
                    {item.excerpt ? <Text numberOfLines={3} className="mt-1 text-[12px] leading-5 text-muted">{item.excerpt}</Text> : null}
                    {item.author ? <Text className="mt-2 text-[10px] text-muted">লেখক: {item.author}</Text> : null}
                  </View>
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </View>

      <Modal visible={Boolean(selectedArticleId)} animationType="slide" onRequestClose={() => setSelectedArticleId(undefined)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center border-b border-line px-4 py-3">
            <TouchableOpacity onPress={() => setSelectedArticleId(undefined)} className="mr-3">
              <Ionicons name="arrow-back" size={24} color={colors.ink} />
            </TouchableOpacity>
            <Text numberOfLines={1} className="flex-1 text-[16px] font-bold text-ink">
              {articleQuery.data?.title ?? 'আর্টিকেল'}
            </Text>
          </View>
          {articleQuery.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : articleQuery.isError ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center text-[13px] text-red-700">{articleQuery.error.message}</Text>
              <TouchableOpacity onPress={() => void articleQuery.refetch()} className="mt-3">
                <Text className="font-bold text-primary">আবার চেষ্টা করুন</Text>
              </TouchableOpacity>
            </View>
          ) : articleQuery.data ? (
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
              {articleQuery.data.image ? (
                <Image source={{ uri: articleQuery.data.image }} resizeMode="cover" className="mb-4 h-52 w-full rounded-2xl bg-primary-light" />
              ) : null}
              <Text className="text-[20px] font-bold text-ink">{articleQuery.data.title}</Text>
              <Text className="my-2 text-[11px] text-muted">
                {[articleQuery.data.category, articleQuery.data.author, articleDate(articleQuery.data)].filter(Boolean).join(' · ')}
              </Text>
              <Text className="text-[14px] leading-6 text-ink">{articleQuery.data.content ?? articleQuery.data.excerpt}</Text>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default BlogScreen;
