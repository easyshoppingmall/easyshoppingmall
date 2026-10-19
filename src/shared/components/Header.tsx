import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { toBengaliNumber } from '../../features/ecommerce/data/catalog';
import { colors } from '../theme/colors';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showCart?: boolean;
  onCartPress?: () => void;
  showProfile?: boolean;
  onProfilePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showCart = true,
  onCartPress,
  showProfile = true,
  onProfilePress,
}) => {
  const cartCount = useAppSelector((state) => state.cart.totalQuantity);

  return (
    <View className="flex-row items-center justify-between py-2 mb-2">
      {title ? (
        <View className="flex-1">
          <Text className="text-[18px] font-bold text-ink">{title}</Text>
          {subtitle ? (
            <Text className="text-[11px] text-muted font-normal mt-0.5">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="flex-1">
          <Text className="text-[17px] font-bold text-primary tracking-tight">
            ইজি শপিং মল বিডি
          </Text>
          <Text className="text-[10px] text-muted font-normal">
            আপনার বিশ্বস্ত অনলাইন শপ
          </Text>
        </View>
      )}

      <View className="flex-row items-center space-x-2">
        {/* Profile Icon Button next to Cart */}
        {showProfile && (
          <TouchableOpacity
            onPress={onProfilePress}
            activeOpacity={0.7}
            className="w-[36px] h-[36px] rounded-full bg-card border border-line items-center justify-center mr-2"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Cart Icon Button with Live Count Badge */}
        {showCart && (
          <TouchableOpacity
            onPress={onCartPress}
            activeOpacity={0.7}
            className="w-[36px] h-[36px] rounded-full bg-card border border-line items-center justify-center relative"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <Ionicons name="cart-outline" size={19} color={colors.ink} />
            {cartCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-accent rounded-full min-w-[17px] h-[17px] px-1 items-center justify-center border border-white">
                <Text className="text-white text-[9px] font-bold">
                  {toBengaliNumber(cartCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default Header;
