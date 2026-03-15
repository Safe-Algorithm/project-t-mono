import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  useAnimatedScrollHandler,
  SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, ThemeColors } from '../../constants/Theme';
import { useTheme } from '../../hooks/useTheme';
import Button from '../../components/ui/Button';
import { useLanguageStore } from '../../store/languageStore';

const { width: W, height: H } = Dimensions.get('window');
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<any>);

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { language, setLanguage, isRTL } = useLanguageStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
  const slides = [
    {
      id: '1',
      title: t('onboarding.slide1Title'),
      subtitle: t('onboarding.slide1Subtitle'),
      icon: 'compass' as const,
      bg: '#EFF6FF',
      iconColor: '#3B82F6',
    },
    {
      id: '2',
      title: t('onboarding.slide2Title'),
      subtitle: t('onboarding.slide2Subtitle'),
      icon: 'shield-checkmark' as const,
      bg: '#F0FDF4',
      iconColor: '#10B981',
    },
    {
      id: '3',
      title: t('onboarding.slide3Title'),
      subtitle: t('onboarding.slide3Subtitle'),
      icon: 'people' as const,
      bg: '#FFF7ED',
      iconColor: '#F97316',
    },
  ];

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TouchableOpacity
        onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
        style={{
          position: 'absolute',
          top: 56,
          right: isRTL ? undefined : 24,
          left: isRTL ? 24 : undefined,
          backgroundColor: colors.primarySurface,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          zIndex: 1,
        }}
      >
        <Text style={{ fontSize: FontSize.sm, color: colors.primary, fontWeight: '700' }}>
          {language === 'en' ? 'العربية' : 'English'}
        </Text>
      </TouchableOpacity>
      <AnimatedFlatList
        ref={flatListRef as any}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / W));
        }}
        renderItem={({ item, index }) => (
          <SlideItem item={item} index={index} scrollX={scrollX} />
        )}
      />

      <View style={{ paddingHorizontal: 24, paddingBottom: 48, gap: 16, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {slides.map((_, i) => (
            <DotIndicator key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        <Button
          title={currentIndex === slides.length - 1 ? t('auth.signIn') : t('common.next')}
          onPress={handleNext}
          fullWidth
          size="lg"
          rightIcon={
            currentIndex < slides.length - 1 ? (
              <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={colors.white} />
            ) : undefined
          }
        />

        {currentIndex < slides.length - 1 && (
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ paddingVertical: 8 }}>
            <Text style={{ fontSize: FontSize.md, color: colors.textTertiary, fontWeight: '500' }}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SlideItem({
  item,
  index,
  scrollX,
}: {
  item: {
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    bg: string;
    iconColor: string;
  };
  index: number;
  scrollX: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * W, index * W, (index + 1) * W];
    const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0]);
    const translateY = interpolate(scrollX.value, inputRange, [40, 0, 40]);
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <View style={{ width: W, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 80 }}>
      <View style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 48 }}>
        <Ionicons name={item.icon} size={100} color={item.iconColor} />
      </View>
      <Animated.View style={[{ alignItems: 'center', gap: 16 }, animStyle]}>
        <Text style={{ fontSize: FontSize.xxxl, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', lineHeight: 36 }}>{item.title}</Text>
        <Text style={{ fontSize: FontSize.lg, color: colors.textSecondary, textAlign: 'center', lineHeight: 26 }}>{item.subtitle}</Text>
      </Animated.View>
    </View>
  );
}

function DotIndicator({
  index,
  scrollX,
}: {
  index: number;
  scrollX: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * W, index * W, (index + 1) * W];
    const width = interpolate(scrollX.value, inputRange, [8, 24, 8]);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4]);
    return { width, opacity };
  });

  return (
    <Animated.View style={[{ height: 8, borderRadius: 4 }, animStyle, { backgroundColor: colors.primary }]} />
  );
}
