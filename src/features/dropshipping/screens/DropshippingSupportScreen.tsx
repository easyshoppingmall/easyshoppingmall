import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '../../ecommerce/api/customerApi';
import type { WebsiteInfo } from '../../ecommerce/api/customerApi';
import { colors } from '../../../shared/theme/colors';

type SupportChannel = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  buttonText: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
};

const SUPPORT_CHANNELS: SupportChannel[] = [
  {
    id: 'facebook-group',
    title: 'অফিসিয়াল ফেসবুক গ্রুপ',
    subtitle: 'আপডেট ও ঘোষণা',
    description:
      'সর্বশেষ পণ্য রিলিজ, মার্কেটিং টিপস, ড্রপশিপিং টিউটোরিয়াল এবং লাইভ ইভেন্টের ঘোষণা পেতে আমাদের ফেসবুক গ্রুপটি লাইক ও ফলো করুন।',
    buttonText: 'গ্রুপে যোগ দিন',
    url: 'https://www.facebook.com/share/g/1DsixBQwcE/',
    icon: 'logo-facebook',
    tint: '#E8F0FE',
  },
  {
    id: 'facebook-page',
    title: 'ফেসবুক পেজ',
    subtitle: 'আমাদের অফিসিয়াল পেজ',
    description:
      'আমাদের অফিসিয়াল ফেসবুক পেজ ভিজিট করুন নতুন সব প্রোডাক্টের আপডেট পেতে, যেকোনো প্রয়োজনে সরাসরি ইনবক্স করতে এবং আমাদের কমিউনিটির সাথে যুক্ত থাকতে।',
    buttonText: 'পেজ ভিজিট করুন',
    url: 'https://www.facebook.com/easyshoppingmall8',
    icon: 'logo-facebook',
    tint: '#E8F0FE',
  },
  {
    id: 'telegram',
    title: 'টেলিগ্রাম চ্যানেল',
    subtitle: '২৪/৭ ক্লায়েন্ট সার্কেল',
    description:
      'আমাদের অফিসিয়াল টেলিগ্রাম কমিউনিটিতে যোগ দিন। এখানে আপনি নিয়মিত আপডেট, মার্কেটিংয়ের জন্য ডাউনলোডযোগ্য মিডিয়া অ্যাসেট, তাৎক্ষণিক ড্রপশিপিং স্টক ফিড এবং একে অপরকে সহায়তা করা স্টোর মালিকদের একটি নেটওয়ার্ক পাবেন।',
    buttonText: 'টেলিগ্রাম চ্যানেলে যোগ দিন',
    url: 'https://t.me/easyshoppingmallbd',
    icon: 'paper-plane-outline',
    tint: '#E4F7FC',
  },
  {
    id: 'whatsapp-group',
    title: 'হোয়াটসঅ্যাপ গ্রুপ',
    subtitle: 'তাৎক্ষণিক কমিউনিটি সহায়তা',
    description:
      'সর্বশেষ পণ্য রিলিজ, মার্কেটিং টিপস, ড্রপশিপিং টিউটোরিয়াল এবং লাইভ ইভেন্টের ঘোষণা পেতে আমাদের হোয়াটসঅ্যাপ গ্রুপে যুক্ত হন।',
    buttonText: 'হোয়াটসঅ্যাপ গ্রুপে যোগ দিন',
    url: 'https://whatsapp.com/channel/0029Vb5hf5D7NoZuvTebe81q',
    icon: 'logo-whatsapp',
    tint: '#E8F8EF',
  },
  {
    id: 'whatsapp-support',
    title: 'হোয়াটসঅ্যাপ সাপোর্ট',
    subtitle: 'সরাসরি এজেন্ট চ্যাট',
    description:
      'যেকোনো জরুরি জিজ্ঞাসা, অর্ডার ট্র্যাকিং, প্রোডাক্টের স্টক আপডেট অথবা তাৎক্ষণিক যেকোনো সহায়তার জন্য সরাসরি আমাদের অফিসিয়াল হোয়াটসঅ্যাপ নাম্বারে মেসেজ করুন।',
    buttonText: 'হোয়াটসঅ্যাপে চ্যাট করুন',
    url: 'https://wa.me/8801626420774',
    icon: 'logo-whatsapp',
    tint: '#E8F8EF',
  },
];

async function openSupportLink(url: string, label: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`${label} খোলা যায়নি`, 'এই মুহূর্তে লিংকটি খোলা সম্ভব হচ্ছে না।');
  }
}

function SupportChannelCard({ channel }: { channel: SupportChannel }) {
  return (
    <View className="mb-3 rounded-[22px] border border-line bg-card p-4">
      <View className="flex-row items-center">
        <View
          className="mr-3 h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: channel.tint }}
        >
          <Ionicons name={channel.icon} size={23} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-ink">{channel.title}</Text>
          <Text className="mt-0.5 text-[11px] font-semibold text-primary">
            {channel.subtitle}
          </Text>
        </View>
      </View>
      <Text className="mt-3 min-h-[72px] text-[12px] leading-[19px] text-muted">
        {channel.description}
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={channel.buttonText}
        onPress={() => void openSupportLink(channel.url, channel.title)}
        className="mt-3 min-h-11 flex-row items-center justify-center rounded-2xl bg-primary px-4 py-2.5"
      >
        <Text className="text-center text-[12px] font-bold text-white">
          {channel.buttonText}
        </Text>
        <Ionicons name="arrow-up-outline" size={15} color="#FFFFFF" style={{ marginLeft: 6 }} />
      </Pressable>
    </View>
  );
}

function ContactInfoItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-[10px] font-semibold text-muted">{label}</Text>
        <Text selectable className="mt-0.5 text-[12px] leading-[18px] text-ink">
          {value}
        </Text>
      </View>
      {onPress ? <Ionicons name="open-outline" size={15} color={colors.muted} /> : null}
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      className="mb-2 flex-row items-center rounded-2xl border border-line bg-white p-3"
    >
      {content}
    </Pressable>
  ) : (
    <View className="mb-2 flex-row items-center rounded-2xl border border-line bg-white p-3">
      {content}
    </View>
  );
}

function WebsiteContactInfo({ info }: { info?: WebsiteInfo }) {
  const phone = info?.number || info?.supportContact;
  const entries = [
    {
      label: 'ঠিকানা',
      value: info?.address,
      icon: 'location-outline' as const,
    },
    {
      label: 'কল করুন',
      value: phone,
      icon: 'call-outline' as const,
      onPress: phone
        ? () => void openSupportLink(`tel:${phone.replace(/[^\d+]/g, '')}`, 'ফোন')
        : undefined,
    },
    {
      label: 'ইমেইল',
      value: info?.email,
      icon: 'mail-outline' as const,
      onPress: info?.email
        ? () => void openSupportLink(`mailto:${info.email}`, 'ইমেইল')
        : undefined,
    },
  ].filter((entry): entry is typeof entry & { value: string } => Boolean(entry.value));

  if (entries.length === 0) {
    return (
      <View className="rounded-2xl border border-line bg-white px-4 py-3">
        <Text className="text-[12px] leading-5 text-muted">
          ওয়েবসাইটে যোগাযোগের তথ্য পাওয়া যায়নি।
        </Text>
      </View>
    );
  }

  return (
    <View>
      {entries.map((entry) => (
        <ContactInfoItem
          key={entry.label}
          icon={entry.icon}
          label={entry.label}
          value={entry.value}
          onPress={entry.onPress}
        />
      ))}
    </View>
  );
}

export function DropshippingSupportScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const websiteInfoQuery = useQuery({
    queryKey: ['customer', 'website-info'],
    queryFn: customerApi.getWebsiteInfo,
  });
  const cardWidth = width >= 900 ? '32%' : width >= 600 ? '48.5%' : '100%';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
          onPress={() => router.replace('/(dropshipping)')}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Text className="text-[17px] font-bold text-ink">সহায়তা কেন্দ্র</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
      >
        <View className="mb-5 mt-2 items-center rounded-[26px] bg-primary-light px-5 py-6">
          <View className="mb-3 h-11 flex-row items-center rounded-full border border-blue-200 bg-white/70 px-3">
            <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
            <Text className="ml-1.5 text-[11px] font-bold text-primary">সহায়তা কেন্দ্র</Text>
          </View>
          <Text className="text-center text-[24px] font-extrabold leading-[34px] text-ink">
            আমরা আজ আপনাকে{' '}
            <Text className="text-primary">কীভাবে সাহায্য করতে পারি?</Text>
          </Text>
          <Text className="mt-3 text-center text-[12px] leading-[20px] text-muted">
            যোগাযোগের জন্য নিচের যেকোনো একটি চ্যানেল নির্বাচন করুন আমাদের সাপোর্ট
            এজেন্টদের সাথে সংযোগ স্থাপন করতে অথবা আমাদের কমিউনিটি গ্রুপে যোগ দিতে।
            আমরা আপনার ব্যবসাকে সহায়তা করতে ২৪/৭ উপলব্ধ আছি।
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-between">
          {SUPPORT_CHANNELS.map((channel) => (
            <View key={channel.id} style={{ width: cardWidth }}>
              <SupportChannelCard channel={channel} />
            </View>
          ))}
        </View>

        <View className="mb-5 flex-row items-start rounded-[22px] border border-blue-100 bg-white p-4">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
            <Ionicons name="flash-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-[14px] font-extrabold text-ink">
              আমাদের তাত্ক্ষণিক সহায়তার অঙ্গীকার
            </Text>
            <Text className="mt-1.5 text-[12px] leading-[19px] text-muted">
              আমরা আপনাকে প্রিমিয়াম সহায়তা প্রদানের জন্য নিবেদিত। যেকোনো গ্রুপে
              সংযুক্ত হওয়ার মাধ্যমে আপনি অগ্রাধিকার সমর্থন পাওয়ার নিশ্চয়তা পাবেন।
            </Text>
          </View>
        </View>

        <View className="rounded-[22px] border border-line bg-white p-4">
          <View className="mb-3 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <Ionicons name="storefront-outline" size={20} color={colors.primary} />
            </View>
            <Text className="text-[16px] font-extrabold text-ink">EasyShoppingMall</Text>
          </View>
          <Text className="mb-4 text-[12px] leading-[19px] text-muted">
            বাংলাদেশের সবচেয়ে বিশ্বস্ত ও দ্রুততম অনলাইন শপিং প্ল্যাটফর্ম। আপনার
            পছন্দের পণ্য পৌঁছে দিচ্ছি আপনার দোরগোড়ায়।
          </Text>
          <Text className="mb-2 text-[13px] font-bold text-ink">যোগাযোগের তথ্য</Text>

          {websiteInfoQuery.isPending ? (
            <View className="flex-row items-center rounded-2xl border border-line bg-bg px-4 py-4">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="ml-2 text-[12px] text-muted">যোগাযোগের তথ্য লোড হচ্ছে…</Text>
            </View>
          ) : websiteInfoQuery.isError && !websiteInfoQuery.data ? (
            <View className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <Text className="text-[12px] leading-5 text-red-700">
                যোগাযোগের তথ্য লোড করা যায়নি।
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void websiteInfoQuery.refetch()}
                className="mt-2 self-start py-1"
              >
                <Text className="text-[12px] font-bold text-primary">আবার চেষ্টা করুন</Text>
              </Pressable>
            </View>
          ) : (
            <WebsiteContactInfo info={websiteInfoQuery.data} />
          )}

          <View className="mt-1 flex-row items-center rounded-2xl bg-primary-light px-3 py-2.5">
            <Ionicons name="time-outline" size={17} color={colors.primary} />
            <Text className="ml-2 text-[11px] font-semibold text-primary-dark">
              কাজের সময়: ২৪/৭ সাপোর্ট
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default DropshippingSupportScreen;
