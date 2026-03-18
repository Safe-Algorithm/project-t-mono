import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

const DISMISS_THRESHOLD_Y = 80;
const DISMISS_THRESHOLD_VY = 0.8;
const SHEET_OFFSCREEN = 800;

/**
 * Reusable drag-to-dismiss logic for bottom sheets.
 *
 * Usage:
 *   const { translateY, backdropOpacity, panHandlers, openSheet, closeSheet } = useDragToDismiss(onClose);
 *
 *   - Set Modal animationType="none"
 *   - Call openSheet() inside a useEffect when visible becomes true
 *   - Spread panHandlers onto the drag zone View (handle + header area)
 *   - Apply { transform: [{ translateY }] } to the Animated.View sheet
 *   - Apply { opacity: backdropOpacity } to the backdrop dim layer
 *   - Call closeSheet() for programmatic close (X button, cancel, etc.)
 */
export function useDragToDismiss(onClose: () => void) {
  const translateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SHEET_OFFSCREEN],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  const openSheet = () => {
    // Always reset to off-screen first so repeated opens start from the same position
    translateY.setValue(SHEET_OFFSCREEN);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 280,
      mass: 0.8,
    }).start();
  };

  const closeSheet = (callback?: () => void) => {
    Animated.timing(translateY, {
      toValue: SHEET_OFFSCREEN,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(SHEET_OFFSCREEN);
      if (callback) callback();
      else onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5 && g.dy > 0,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD_Y || g.vy > DISMISS_THRESHOLD_VY) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  // Call this synchronously in the onPress that opens the sheet,
  // BEFORE setting the visible state. This ensures translateY is at
  // SHEET_OFFSCREEN when Modal first mounts so there is no visible flash.
  const resetForOpen = () => { translateY.setValue(SHEET_OFFSCREEN); };

  return {
    translateY,
    backdropOpacity,
    panHandlers: panResponder.panHandlers,
    openSheet,
    closeSheet,
    resetForOpen,
  };
}
