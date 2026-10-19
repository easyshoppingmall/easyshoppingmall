import React from 'react';
import { View, Text } from 'react-native';
import { BENEFITS } from '../../features/ecommerce/data/catalog';

export const PerksCard: React.FC = () => {
  return (
    <View
      className="bg-card border border-line rounded-[14px] p-3 mb-3 flex-row justify-around items-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      {BENEFITS.map((benefit) => (
        <View key={benefit.id} className="items-center flex-1 px-1">
          <Text className="text-[22px] mb-1">{benefit.icon}</Text>
          <Text className="text-[11px] font-semibold text-ink text-center">
            {benefit.title}
          </Text>
          {benefit.description ? (
            <Text className="text-[9px] text-muted text-center mt-0.5">
              {benefit.description}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
};

export default PerksCard;
