import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface CenterShopButtonProps {
  isFocused: boolean;
  onPress: () => void;
  label?: string;
}

export const CenterShopButton: React.FC<CenterShopButtonProps> = ({
  isFocused,
  onPress,
  label = 'শপ',
}) => {
  const rotateAnim = useMemo(() => new Animated.Value(0), []);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  // Continuous rotating circle animation
  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    // Subtle breathing pulse for focus
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [rotateAnim, pulseAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className="items-center justify-center -top-4">
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={label}
        className="items-center justify-center relative"
      >
        {/* Animated Rotating Outer Ring */}
        <Animated.View
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            borderWidth: 2.5,
            borderTopColor: colors.primary,
            borderRightColor: '#60A5FA',
            borderBottomColor: '#BAE6FD',
            borderLeftColor: '#38BDF8',
            position: 'absolute',
            transform: [{ rotate: spin }],
          }}
        />

        {/* Pulsing Glow Shadow Layer */}
        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }],
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isFocused ? 0.45 : 0.28,
            shadowRadius: 6,
            elevation: 8,
          }}
        >
          {/* Main Elevated Circular Center Button */}
          <View
            className={`w-[48px] h-[48px] rounded-full items-center justify-center border-2 border-white ${
              isFocused ? 'bg-primaryDark' : 'bg-primary'
            }`}
          >
            <Ionicons name="bag-handle" size={23} color="#FFFFFF" />
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* Label under center button */}
      <Text
        className={`text-[10px] mt-1 font-bold ${
          isFocused ? 'text-primary' : 'text-muted'
        }`}
      >
        {label}
      </Text>
    </View>
  );
};

export default CenterShopButton;
