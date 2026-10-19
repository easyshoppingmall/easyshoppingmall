import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../../shared/components/Header';
import { colors } from '../../../shared/theme/colors';
import { toBengaliNumber } from '../data/catalog';
import { customerApi } from '../api/customerApi';
import { getProductsPage } from '../api/homeApi';
import { useCategoriesQuery } from '../api/queries';
import type { WebsiteInfo } from '../api/customerApi';

type IconName = keyof typeof Ionicons.glyphMap;

interface AboutSectionHeadingProps {
  title: string;
  description: string;
  icon: IconName;
}

function AboutSectionHeading({ title, description, icon }: AboutSectionHeadingProps) {
  return (
    <View className="mb-3 mt-6 flex-row items-center">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-[16px] font-extrabold text-ink">{title}</Text>
        <Text className="mt-0.5 text-[11px] leading-4 text-muted">{description}</Text>
      </View>
    </View>
  );
}

interface InfoCardProps {
  icon: IconName;
  title: string;
  description: string;
  tint?: string;
}

function InfoCard({ icon, title, description, tint = colors.tintBlue }: InfoCardProps) {
  return (
    <View className="mb-2.5 w-[48%] rounded-2xl border border-line bg-card p-3.5 shadow-sm">
      <View
        className="mb-2.5 h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: tint }}
      >
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <Text className="text-[12px] font-bold text-ink">{title}</Text>
      <Text className="mt-1 text-[11px] leading-[17px] text-muted">{description}</Text>
    </View>
  );
}

interface ModelStepProps {
  step: string;
  title: string;
  description: string;
  icon: IconName;
}

function ModelStep({ step, title, description, icon }: ModelStepProps) {
  return (
    <View className="mb-2.5 flex-row items-center rounded-2xl border border-line bg-card p-3.5">
      <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-primary-light">
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-[10px] font-bold text-primary">ধাপ {step}</Text>
        <Text className="mt-0.5 text-[13px] font-bold text-ink">{title}</Text>
        <Text className="mt-1 text-[11px] leading-[17px] text-muted">{description}</Text>
      </View>
    </View>
  );
}

function getWebsiteUrl(websiteInfo?: WebsiteInfo): string | undefined {
  const value = websiteInfo?.website;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
}

async function openContactLink(url: string, label: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`${label} খোলা যায়নি`, 'এই মুহূর্তে লিংকটি খোলা সম্ভব হচ্ছে না।');
  }
}

export const AboutScreen: React.FC = () => {
  const websiteInfoQuery = useQuery({
    queryKey: ['customer', 'website-info'],
    queryFn: customerApi.getWebsiteInfo,
  });
  const categoriesQuery = useCategoriesQuery();
  const productCountQuery = useQuery({
    queryKey: ['catalog', 'about-statistics', 'products'],
    queryFn: () => getProductsPage({ page: 1, limit: 1 }),
  });
  const websiteInfo = websiteInfoQuery.data;
  const supportNumber = websiteInfo?.number ?? websiteInfo?.supportContact;
  const websiteUrl = getWebsiteUrl(websiteInfo);
  const hasContactInfo = Boolean(
    supportNumber || websiteInfo?.email || websiteInfo?.address || websiteUrl
  );
  const productTotal = productCountQuery.data?.totalCount;
  const categoryTotal = categoriesQuery.data?.length;
  const hasStatistics = productTotal !== undefined || categoryTotal !== undefined;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg px-4">
      <Header title="আমাদের সম্পর্কে" showCart={false} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <LinearGradient
          colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ overflow: 'hidden', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 20 }}
        >
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <Ionicons name="storefront-outline" size={27} color="#FFFFFF" />
          </View>
          <Text className="text-[11px] font-bold tracking-[1.5px] text-white/80">
            সহজ কেনাকাটা, নতুন সম্ভাবনা
          </Text>
          <Text className="mt-1.5 text-[22px] font-extrabold text-white">
            EasyShoppingMallBD
          </Text>
          <Text className="mt-2 text-[12px] leading-[20px] text-white/90">
            অনলাইনে পণ্য খোঁজা থেকে অর্ডার করা—কেনাকাটার প্রতিটি ধাপ সহজ করার একটি
            উদ্যোগ। ক্রেতা এবং অনলাইন ব্যবসায় আগ্রহী মানুষের জন্য একই প্ল্যাটফর্মে
            কেনাকাটা ও ড্রপশিপিংয়ের অভিজ্ঞতা।
          </Text>
          <View className="mt-4 flex-row items-center self-start rounded-full bg-white/15 px-3 py-1.5">
            <Ionicons name="checkmark-circle-outline" size={15} color="#FFFFFF" />
            <Text className="ml-1.5 text-[10px] font-semibold text-white">
              আস্থা, স্বচ্ছতা ও গ্রাহকসেবায় প্রতিশ্রুতিবদ্ধ
            </Text>
          </View>
        </LinearGradient>

        <AboutSectionHeading
          title="আমাদের পরিচয়"
          description="এক জায়গায় পণ্য খোঁজা, কেনা ও ব্যবসার সুযোগ"
          icon="people-outline"
        />
        <View className="rounded-2xl border border-line bg-card p-4">
          <Text className="text-[12px] leading-[20px] text-ink">
            EasyShoppingMallBD হলো অনলাইনভিত্তিক কেনাকাটা ও ড্রপশিপিংয়ের একটি
            প্ল্যাটফর্ম। বিভিন্ন ক্যাটাগরির পণ্য দেখা, পণ্যের বিবরণ ও মূল্য যাচাই,
            কার্টে যোগ করা এবং অর্ডার সম্পন্ন করার সুবিধা এখানে একসঙ্গে রয়েছে।
          </Text>
          <Text className="mt-2.5 text-[12px] leading-[20px] text-muted">
            সহজ ব্যবহার, পরিষ্কার পণ্যের তথ্য এবং সহায়তার জন্য যোগাযোগের ব্যবস্থা
            রেখে আমরা প্রতিটি কেনাকাটাকে আরও নির্ভরযোগ্য ও স্বচ্ছ করতে চাই।
          </Text>
        </View>

        <AboutSectionHeading
          title="আমাদের পরিসংখ্যান"
          description="সার্ভারে থাকা বর্তমান তথ্য"
          icon="bar-chart-outline"
        />
        {categoriesQuery.isLoading || productCountQuery.isLoading ? (
          <View className="items-center rounded-2xl border border-line bg-card py-5">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="mt-2 text-[11px] text-muted">তথ্য লোড হচ্ছে…</Text>
          </View>
        ) : hasStatistics ? (
          <View className="flex-row justify-between">
            {productTotal !== undefined ? (
              <View className="mr-2 flex-1 rounded-2xl border border-line bg-card p-3.5">
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
                <Text className="mt-2 text-[19px] font-extrabold text-ink">
                  {toBengaliNumber(productTotal)}
                </Text>
                <Text className="mt-0.5 text-[11px] text-muted">মোট পণ্য</Text>
              </View>
            ) : null}
            {categoryTotal !== undefined ? (
              <View className="flex-1 rounded-2xl border border-line bg-card p-3.5">
                <Ionicons name="grid-outline" size={20} color={colors.success} />
                <Text className="mt-2 text-[19px] font-extrabold text-ink">
                  {toBengaliNumber(categoryTotal)}
                </Text>
                <Text className="mt-0.5 text-[11px] text-muted">পণ্যের ক্যাটাগরি</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="rounded-2xl border border-line bg-card px-4 py-3.5">
            <Text className="text-[11px] leading-[18px] text-muted">
              পরিসংখ্যানের তথ্য বর্তমানে পাওয়া যাচ্ছে না।
            </Text>
            {(categoriesQuery.isError || productCountQuery.isError) ? (
              <TouchableOpacity
                onPress={() => {
                  if (categoriesQuery.isError) void categoriesQuery.refetch();
                  if (productCountQuery.isError) void productCountQuery.refetch();
                }}
                className="mt-2 self-start"
              >
                <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা করুন</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        {(categoriesQuery.isError || productCountQuery.isError) && hasStatistics ? (
          <View className="mt-2 flex-row items-center rounded-xl bg-tint-orange px-3 py-2.5">
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text className="ml-2 flex-1 text-[10px] leading-4 text-ink">
              কিছু পরিসংখ্যান লোড হয়নি।
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (categoriesQuery.isError) void categoriesQuery.refetch();
                if (productCountQuery.isError) void productCountQuery.refetch();
              }}
            >
              <Text className="text-[10px] font-bold text-primary">আবার চেষ্টা</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <AboutSectionHeading
          title="আমাদের সেবাসমূহ"
          description="কেনাকাটার প্রয়োজনীয় সুবিধাগুলো একসঙ্গে"
          icon="sparkles-outline"
        />
        <View className="flex-row flex-wrap justify-between">
          <InfoCard
            icon="bag-handle-outline"
            title="সহজ অনলাইন কেনাকাটা"
            description="পণ্য দেখুন, বিবরণ ও মূল্য মিলিয়ে কার্টে যোগ করুন।"
          />
          <InfoCard
            icon="grid-outline"
            title="বিভিন্ন ক্যাটাগরি"
            description="ক্যাটাগরি ধরে পণ্য খুঁজে নেওয়ার সুবিধা।"
            tint={colors.tintPurple}
          />
          <InfoCard
            icon="receipt-outline"
            title="সহজ অর্ডার প্রক্রিয়া"
            description="কার্ট থেকে ঠিকানা ও পেমেন্টের তথ্য দিয়ে অর্ডার করুন।"
            tint={colors.tintGreen}
          />
          {websiteInfo?.deliveryText ? (
            <InfoCard
              icon="car-outline"
              title="ডেলিভারি তথ্য"
              description={websiteInfo.deliveryText}
              tint={colors.tintOrange}
            />
          ) : null}
          {supportNumber || websiteInfo?.email ? (
            <InfoCard
              icon="headset-outline"
              title="গ্রাহক সহায়তা"
              description="প্রয়োজনে দেওয়া ফোন নম্বর বা ইমেইলে যোগাযোগ করুন।"
              tint={colors.tintYellow}
            />
          ) : null}
        </View>

        <AboutSectionHeading
          title="আমাদের ই-কমার্স মডেল"
          description="ক্রেতার জন্য সহজ, ধাপে ধাপে কেনাকাটা"
          icon="cart-outline"
        />
        <View>
          <ModelStep
            step="১"
            title="পণ্য খুঁজুন"
            description="ক্যাটাগরি বা সার্চ ব্যবহার করে পণ্য দেখুন; বিবরণ ও মূল্য যাচাই করুন।"
            icon="search-outline"
          />
          <ModelStep
            step="২"
            title="কার্টে যোগ করুন"
            description="পছন্দের পণ্য ও প্রয়োজনীয় পরিমাণ কার্টে রেখে অর্ডারের জন্য প্রস্তুত করুন।"
            icon="bag-add-outline"
          />
          <ModelStep
            step="৩"
            title="অর্ডার ও পেমেন্ট"
            description="ডেলিভারির ঠিকানা দিন, অর্ডার নিশ্চিত করার ধাপে পেমেন্টের তথ্য পূরণ করুন।"
            icon="card-outline"
          />
          <View className="flex-row items-start rounded-xl bg-primary-light px-3.5 py-3">
            <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
            <Text className="ml-2 flex-1 text-[10px] leading-[17px] text-ink">
              পণ্যের মূল্য ও অর্ডারের মোট পরিমাণ অর্ডার নিশ্চিত করার ধাপে যাচাই করে নিন। অর্ডারের
              অবস্থা অ্যাপের অর্ডার অংশ থেকে দেখা যায়।
            </Text>
          </View>
        </View>

        <AboutSectionHeading
          title="আমাদের ড্রপশিপিং মডেল"
          description="নিজের অনলাইন বিক্রির সুযোগ, আলাদা অভিজ্ঞতা"
          icon="storefront-outline"
        />
        <View className="mb-2.5 rounded-2xl border border-line bg-card p-4">
          <Text className="text-[12px] leading-[19px] text-muted">
            ড্রপশিপিংয়ে বিক্রেতা প্ল্যাটফর্মের পণ্য বেছে নিজের ক্রেতার কাছে
            উপস্থাপন করেন। অর্ডার ও বিক্রির ব্যবস্থাপনা ড্রপশিপিং অ্যাকাউন্টের
            মাধ্যমে করা যায়; বিক্রেতাকে নিজস্ব অনলাইন ব্যবসা গুছিয়ে নিতে সহায়তা
            করাই এই মডেলের উদ্দেশ্য।
          </Text>
        </View>
        <View className="flex-row flex-wrap justify-between">
          <InfoCard
            icon="person-outline"
            title="সাধারণ ক্রেতা"
            description="পণ্য বেছে কার্টে যোগ করে অর্ডার নিশ্চিত করার ধাপে নিজের অর্ডার সম্পন্ন করুন।"
            tint={colors.tintBlue}
          />
          <InfoCard
            icon="briefcase-outline"
            title="ড্রপশিপিং ব্যবহারকারী"
            description="পণ্য ব্রাউজ, নিজের দামে বিক্রি এবং অর্ডার পরিচালনার সুবিধা নিন।"
            tint={colors.tintPurple}
          />
          <InfoCard
            icon="wallet-outline"
            title="আয় ও পেমেন্ট অনুরোধ"
            description="ড্যাশবোর্ডে আয়ের তথ্য ও পেমেন্ট অনুরোধের অপশন রয়েছে; প্রাপ্যতা অ্যাকাউন্টভেদে হতে পারে।"
            tint={colors.tintGreen}
          />
          <InfoCard
            icon="people-outline"
            title="ব্যবসা পরিচালনা"
            description="ড্রপশিপিং অংশে অর্ডার, টিম ও শেখার সুবিধার জন্য আলাদা অপশন রয়েছে।"
            tint={colors.tintOrange}
          />
        </View>
        <View className="mt-0.5 flex-row items-start rounded-xl bg-tint-orange px-3.5 py-3">
          <Ionicons name="time-outline" size={16} color={colors.warning} />
          <Text className="ml-2 flex-1 text-[10px] leading-[17px] text-ink">
            ড্রপশিপিংয়ের কিছু সুবিধা ধাপে ধাপে চালু হতে পারে; আপনার অ্যাকাউন্টে
            প্রদর্শিত সুবিধা ও শর্তই প্রযোজ্য।
          </Text>
        </View>

        <AboutSectionHeading
          title="আমাদের লক্ষ্য ও ভবিষ্যৎ"
          description="সহজ অভিজ্ঞতা থেকে আরও অন্তর্ভুক্তিমূলক অনলাইন ব্যবসা"
          icon="compass-outline"
        />
        <View className="rounded-2xl border border-line bg-card p-4">
          <View className="flex-row items-start">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
              <Ionicons name="flag-outline" size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-[12px] font-extrabold text-ink">আমাদের মিশন</Text>
              <Text className="mt-1 text-[11px] leading-[18px] text-muted">
                সহজ, নির্ভরযোগ্য ও সুবিধাজনক অনলাইন কেনাকাটার অভিজ্ঞতা দেওয়া।
              </Text>
            </View>
          </View>
          <View className="my-3 border-t border-line" />
          <View className="flex-row items-start">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-tint-purple">
              <Ionicons name="eye-outline" size={18} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <Text className="text-[12px] font-extrabold text-ink">আমাদের ভিশন</Text>
              <Text className="mt-1 text-[11px] leading-[18px] text-muted">
                ই-কমার্স ও ড্রপশিপিংয়ের মাধ্যমে অনলাইন ব্যবসাকে আরও সহজলভ্য করা।
              </Text>
            </View>
          </View>
        </View>

        <AboutSectionHeading
          title="যোগাযোগ ও সহায়তা"
          description="ওয়েবসাইটের তথ্য থেকে নেওয়া যোগাযোগের মাধ্যম"
          icon="chatbubbles-outline"
        />
        {websiteInfoQuery.isLoading ? (
          <View className="items-center rounded-2xl border border-line bg-card py-5">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="mt-2 text-[11px] text-muted">যোগাযোগের তথ্য লোড হচ্ছে…</Text>
          </View>
        ) : websiteInfoQuery.isError ? (
          <View className="rounded-2xl border border-line bg-card p-4">
            <Text className="text-[11px] leading-[18px] text-muted">
              যোগাযোগের তথ্য লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।
            </Text>
            <TouchableOpacity
              onPress={() => void websiteInfoQuery.refetch()}
              className="mt-2 self-start"
            >
              <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা করুন</Text>
            </TouchableOpacity>
          </View>
        ) : hasContactInfo ? (
          <View className="rounded-2xl border border-line bg-card px-4">
            {supportNumber ? (
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void openContactLink(
                    `tel:${supportNumber.replace(/[^\d+]/g, '')}`,
                    'ফোন নম্বর'
                  )
                }
                className="flex-row items-center border-b border-line py-3.5"
              >
                <Ionicons name="call-outline" size={18} color={colors.primary} />
                <View className="ml-3 flex-1">
                  <Text className="text-[10px] font-semibold text-muted">ফোন / সহায়তা</Text>
                  <Text selectable className="mt-0.5 text-[12px] text-ink">{supportNumber}</Text>
                </View>
                <Ionicons name="open-outline" size={15} color={colors.muted} />
              </Pressable>
            ) : null}
            {websiteInfo?.email ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void openContactLink(`mailto:${websiteInfo.email}`, 'ইমেইল')}
                className="flex-row items-center border-b border-line py-3.5"
              >
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
                <View className="ml-3 flex-1">
                  <Text className="text-[10px] font-semibold text-muted">ইমেইল</Text>
                  <Text selectable className="mt-0.5 text-[12px] text-ink">{websiteInfo.email}</Text>
                </View>
                <Ionicons name="open-outline" size={15} color={colors.muted} />
              </Pressable>
            ) : null}
            {websiteUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void openContactLink(websiteUrl, 'ওয়েবসাইট')}
                className="flex-row items-center border-b border-line py-3.5"
              >
                <Ionicons name="globe-outline" size={18} color={colors.primary} />
                <View className="ml-3 flex-1">
                  <Text className="text-[10px] font-semibold text-muted">ওয়েবসাইট</Text>
                  <Text selectable className="mt-0.5 text-[12px] text-ink">{websiteUrl}</Text>
                </View>
                <Ionicons name="open-outline" size={15} color={colors.muted} />
              </Pressable>
            ) : null}
            {websiteInfo?.address ? (
              <View className="flex-row items-start py-3.5">
                <Ionicons name="location-outline" size={18} color={colors.primary} />
                <View className="ml-3 flex-1">
                  <Text className="text-[10px] font-semibold text-muted">ঠিকানা</Text>
                  <Text selectable className="mt-0.5 text-[12px] leading-[18px] text-ink">
                    {websiteInfo.address}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="rounded-2xl border border-line bg-card px-4 py-3.5">
            <Text className="text-[11px] leading-[18px] text-muted">
              যোগাযোগের তথ্য বর্তমানে পাওয়া যাচ্ছে না।
            </Text>
          </View>
        )}
        <Text className="mt-5 text-center text-[10px] text-muted">
          EasyShoppingMallBD · আপনার কেনাকাটার সঙ্গী
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AboutScreen;
