import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Faq } from '../../features/ecommerce/data/catalog';
import { colors } from '../theme/colors';

interface FaqAccordionProps {
  faqs: Faq[];
}

export const FaqAccordion: React.FC<FaqAccordionProps> = ({ faqs }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <View className="bg-card border border-line rounded-[14px] px-3 py-1 mb-3">
      {faqs.map((faq, index) => {
        const isExpanded = expandedId === faq.id;
        const isLast = index === faqs.length - 1;

        return (
          <View
            key={faq.id}
            className={`${!isLast ? 'border-b border-line' : ''} py-2.5`}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => toggle(faq.id)}
              className="flex-row items-center justify-between"
            >
              <Text className="text-[13px] font-semibold text-ink flex-1 pr-2">
                {faq.question}
              </Text>
              <View
                className="w-5 h-5 rounded-full items-center justify-center"
                style={{
                  backgroundColor: isExpanded ? colors.primaryLight : '#F1F5F9',
                }}
              >
                <Text
                  className="text-[13px] font-bold"
                  style={{ color: isExpanded ? colors.primary : colors.muted }}
                >
                  {isExpanded ? '−' : '＋'}
                </Text>
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View className="mt-2 pt-1">
                <Text className="text-[12px] text-muted leading-[18px]">
                  {faq.answer}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default FaqAccordion;
