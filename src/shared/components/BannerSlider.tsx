import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageLoadEventData } from 'react-native';
import type { Banner } from '../../features/ecommerce/data/catalog';

interface BannerSliderProps {
  banners: Banner[];
  onBannerPress?: (banner: Banner) => void;
  autoPlayInterval?: number;
}

export const BannerSlider: React.FC<BannerSliderProps> = ({
  banners,
  onBannerPress,
  autoPlayInterval = 3800,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const scrollRef = useRef<ScrollView>(null);
  const isInteracting = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoPlay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length <= 1) return;

    timerRef.current = setInterval(() => {
      if (isInteracting.current || containerWidth === 0) return;
      setActiveIndex((previousIndex) => {
        const nextIndex = (previousIndex + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: nextIndex * containerWidth, animated: true });
        return nextIndex;
      });
    }, autoPlayInterval);
  }, [autoPlayInterval, banners.length, containerWidth]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startAutoPlay]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) setContainerWidth(width);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth === 0) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
    if (index >= 0 && index < banners.length) setActiveIndex(index);
    isInteracting.current = false;
  };

  const getImageHeight = (bannerId: string) => {
    const ratio = imageRatios[bannerId];
    if (!ratio || containerWidth === 0) return 176;
    return Math.min(270, Math.max(132, containerWidth / ratio));
  };

  return (
    <View className="mb-3" onLayout={handleLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          isInteracting.current = true;
        }}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {banners.map((banner) => {
          const height = getImageHeight(banner.id);
          return (
            <View key={banner.id} style={{ width: containerWidth || '100%' }}>
              <TouchableOpacity
                activeOpacity={onBannerPress ? 0.9 : 1}
                accessibilityRole={onBannerPress ? 'button' : undefined}
                onPress={() => onBannerPress?.(banner)}
                className="items-center justify-center overflow-hidden rounded-[18px] bg-white"
                style={{ width: containerWidth || '100%', height }}
              >
                {banner.image ? (
                  <Image
                    source={{ uri: banner.image }}
                    resizeMode="contain"
                    onLoad={(event: NativeSyntheticEvent<ImageLoadEventData>) => {
                      const { width, height: imageHeight } = event.nativeEvent.source;
                      if (width > 0 && imageHeight > 0) {
                        setImageRatios((current) => ({
                          ...current,
                          [banner.id]: width / imageHeight,
                        }));
                      }
                    }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : null}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {banners.length > 1 ? (
        <View className="mt-2.5 flex-row items-center justify-center">
          {banners.map((banner, index) => (
            <View
              key={banner.id}
              className={`mx-0.5 h-1.5 rounded-full ${
                index === activeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-line'
              }`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default BannerSlider;
