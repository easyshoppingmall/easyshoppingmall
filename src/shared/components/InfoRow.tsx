import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

interface InfoRowProps {
  icon: string;
  title: string;
  subtitle: string;
  isLast?: boolean;
  onPress?: () => void;
  iconBgColor?: string;
  rightAction?: React.ReactNode;
}

export const InfoRow: React.FC<InfoRowProps> = ({
  icon,
  title,
  subtitle,
  isLast = false,
  onPress,
  iconBgColor = colors.primaryLight,
  rightAction,
}) => {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      className={`flex-row items-center py-2.5 ${
        !isLast ? 'border-b border-line' : ''
      }`}
    >
      <View
        className="w-[36px] h-[36px] rounded-[10px] items-center justify-center mr-2.5"
        style={{ backgroundColor: iconBgColor }}
      >
        <Text className="text-[17px]">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[13px] font-semibold text-ink">{title}</Text>
        <Text className="text-[11px] text-muted font-normal mt-0.5">
          {subtitle}
        </Text>
      </View>
      {rightAction}
    </Container>
  );
};

export default InfoRow;
