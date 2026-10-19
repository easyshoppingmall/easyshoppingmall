import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  actionIcon?: 'mic' | 'filter';
  onActionPress?: () => void;
  isFilterActive?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'আপনি কী খুঁজছেন?',
  value,
  onChangeText,
  onSubmitEditing,
  actionIcon = 'mic',
  onActionPress,
  isFilterActive = false,
}) => {
  return (
    <View className="flex-row items-center bg-card border border-line rounded-[12px] px-3 py-2 mb-3">
      <Ionicons name="search-outline" size={18} color={colors.muted} />
      <TextInput
        className="flex-1 text-[13px] text-ink ml-2 p-0"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
      />
      {actionIcon === 'mic' ? (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.7}
          className="p-1"
        >
          <Ionicons name="mic-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.7}
          className={`flex-row items-center px-2 py-0.5 rounded-[8px] ${
            isFilterActive ? 'bg-primary-light' : 'bg-transparent'
          }`}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={isFilterActive ? colors.primary : colors.muted}
          />
          <Text
            className={`text-[11px] ml-1 font-medium ${
              isFilterActive ? 'text-primary' : 'text-muted'
            }`}
          >
            ফিল্টার
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchBar;
