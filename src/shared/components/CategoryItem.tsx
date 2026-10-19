import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Category } from '../../features/ecommerce/data/catalog';

interface CategoryItemProps {
  category: Category;
  onPress: (category: Category) => void;
  isSelected?: boolean;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  onPress,
  isSelected = false,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(category)}
      className="items-center flex-1 mx-1"
    >
      <View
        className={`w-12 h-12 rounded-[14px] items-center justify-center mb-1.5 border ${
          isSelected ? 'border-primary bg-primary-light' : 'border-transparent'
        }`}
        style={{
          backgroundColor: isSelected ? undefined : category.bgColor,
        }}
      >
        {category.image ? (
          <Image
            source={{ uri: category.image }}
            resizeMode="cover"
            className="h-full w-full rounded-[14px]"
          />
        ) : (
          <Text className="text-[20px]">{category.icon}</Text>
        )}
      </View>
      <Text
        numberOfLines={1}
        className={`text-[11px] text-center ${
          isSelected ? 'font-bold text-primary' : 'font-medium text-ink'
        }`}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  );
};

interface CategoryChipProps {
  categoryName: string;
  isSelected: boolean;
  onPress: () => void;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  categoryName,
  isSelected,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`px-3.5 py-1.5 rounded-[20px] mr-2 border ${
        isSelected
          ? 'bg-primary border-primary'
          : 'bg-card border-line'
      }`}
    >
      <Text
        className={`text-[12px] font-medium ${
          isSelected ? 'text-white font-semibold' : 'text-ink'
        }`}
      >
        {categoryName}
      </Text>
    </TouchableOpacity>
  );
};

export default CategoryItem;
