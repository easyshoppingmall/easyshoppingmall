import React from 'react';
import { View } from 'react-native';

export function ProductGridSkeleton() {
  return (
    <View className="flex-row flex-wrap justify-between">
      {Array.from({ length: 6 }, (_, index) => (
        <View
          key={index}
          className="mb-3 w-[48%] rounded-[14px] border border-line bg-white p-2"
        >
          <View className="h-[112px] rounded-[10px] bg-slate-100" />
          <View className="mt-2 h-3 w-4/5 rounded-full bg-slate-100" />
          <View className="mt-1 h-3 w-3/5 rounded-full bg-slate-100" />
          <View className="mt-3 h-4 w-2/5 rounded-full bg-slate-100" />
        </View>
      ))}
    </View>
  );
}

export default ProductGridSkeleton;
