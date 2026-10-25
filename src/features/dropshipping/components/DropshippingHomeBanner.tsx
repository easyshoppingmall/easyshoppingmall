import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { Image } from 'expo-image';
import type { DropshippingBanner } from '../api/homeApi';
import { colors } from '../../../shared/theme/colors';

interface DropshippingHomeBannerProps {
  banners: DropshippingBanner[];
}

export function DropshippingHomeBanner({ banners }: DropshippingHomeBannerProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const interacting = useRef(false);

  useEffect(() => {
    if (banners.length < 2 || width <= 0) return;
    const timer = setInterval(() => {
      if (interacting.current) return;
      setActiveIndex((index) => {
        const nextIndex = (index + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
        return nextIndex;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length, width]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    if (index >= 0 && index < banners.length) setActiveIndex(index);
    interacting.current = false;
  };

  return (
    <View
      className="overflow-hidden rounded-[20px] border border-line bg-white"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== width) setWidth(nextWidth);
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          interacting.current = true;
        }}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {banners.map((banner) => (
          <View
            key={banner.id}
            style={{ width: width || '100%' }}
            className="h-[168px] justify-end overflow-hidden bg-slate-100"
          >
            <Image
              source={{ uri: banner.image }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={banner.id}
              style={{ width: '100%', height: '100%', position: 'absolute' }}
            />
            {banner.title || banner.description ? (
              <View className="bg-black/45 px-4 py-3">
                {banner.title ? (
                  <Text numberOfLines={1} className="text-[16px] font-bold text-white">
                    {banner.title}
                  </Text>
                ) : null}
                {banner.description ? (
                  <Text numberOfLines={2} className="mt-1 text-[12px] text-white">
                    {banner.description}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {banners.length > 1 ? (
        <View className="absolute bottom-2 right-3 flex-row items-center rounded-full bg-black/25 px-2 py-1">
          <Text className="text-[10px] font-semibold text-white">
            {activeIndex + 1} / {banners.length}
          </Text>
        </View>
      ) : null}
      {banners.length === 0 ? (
        <View className="h-[168px] items-center justify-center bg-primaryLight">
          <Text style={{ color: colors.muted }} className="text-[12px]">
            এখন কোনো ব্যানার নেই
          </Text>
        </View>
      ) : null}
    </View>
  );
}
