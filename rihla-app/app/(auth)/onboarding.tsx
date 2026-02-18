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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  useAnimatedScrollHandler,
  SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/Theme';
import Button from '../../components/ui/Button';

const { width: W, height: H } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Discover Amazing Trips',
    subtitle: 'Find curated travel experiences across Saudi Arabia and beyond',
    icon: 'compass' as const,
    bg: '#EFF6FF',
    iconColor: '#3B82F6',
  },
  {
    id: '2',
    title: 'Book with Confidence',
    subtitle: 'Secure payments, verified providers, and instant confirmations',
    icon: 'shield-checkmark' as const,
    bg: '#F0FDF4',
    iconColor: '#10B981',
  },
  {
    id: '3',
    title: 'Travel Your Way',
    subtitle: 'Choose packages that fit your group size, budget, and schedule',
    icon: 'people' as const,
    bg: '#FFF7ED',
    iconColor: '#F97316',
  },
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<typeof SLIDES[0]>);

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <AnimatedFlatList
        ref={flatListRef as any}
        data={SLIDES}
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

      {/* Bottom controls */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <DotIndicator key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        <Button
          title={currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          fullWidth
          size="lg"
          rightIcon={
            currentIndex < SLIDES.length - 1 ? (
              <Ionicons name="arrow-forward" size={18} color={Colors.white} />
            ) : undefined
          }
        />

        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
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
  item: typeof SLIDES[0];
  index: number;
  scrollX: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * W, index * W, (index + 1) * W];
    const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0]);
    const translateY = interpolate(scrollX.value, inputRange, [40, 0, 40]);
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <View style={[styles.slide, { width: W }]}>
      <View style={[styles.iconContainer, { backgroundColor: item.bg }]}>
        <Ionicons name={item.icon} size={100} color={item.iconColor} />
      </View>
      <Animated.View style={[styles.textContainer, animStyle]}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
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
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * W, index * W, (index + 1) * W];
    const width = interpolate(scrollX.value, inputRange, [8, 24, 8]);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4]);
    return { width, opacity };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        animStyle,
        { backgroundColor: Colors.primary },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  textContainer: { alignItems: 'center', gap: 16 },
  slideTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
  },
  slideSubtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 16,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dot: { height: 8, borderRadius: 4 },
  skip: { paddingVertical: 8 },
  skipText: { fontSize: FontSize.md, color: Colors.textTertiary, fontWeight: '500' },
});
