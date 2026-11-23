/**
 * The arriving dock screen's slide — see `.fork/customizations.yaml#no3y-mobile-redesign`: from
 * 24pt on the side the dock was travelled from (fork/no3yDockMove.ts), with a fade (a fade alone
 * under Reduce Motion).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { pendingNo3yDockDirection } from "./no3yDockMove";

const SHIFT = 24;
const DURATION = 220;
const REDUCED_DURATION = 150;

/** The arriving dock screen's slide and fade, run on the UI thread and restartable mid-flight. */
export function useNo3yDockEnterStyle() {
  const reduceMotion = useReducedMotion();
  const initial = pendingNo3yDockDirection();
  const shift = useSharedValue(initial === null || reduceMotion ? 0 : SHIFT * initial);
  const opacity = useSharedValue(initial === null ? 1 : 0);
  useFocusEffect(
    useCallback(() => {
      const direction = pendingNo3yDockDirection();
      if (direction === null) return;
      const timing = {
        duration: reduceMotion ? REDUCED_DURATION : DURATION,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      };
      shift.set(reduceMotion ? 0 : SHIFT * direction);
      opacity.set(0);
      shift.set(withTiming(0, timing));
      opacity.set(withTiming(1, timing));
    }, [opacity, reduceMotion, shift]),
  );
  return useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.get(),
    transform: [{ translateX: shift.get() }],
  }));
}
