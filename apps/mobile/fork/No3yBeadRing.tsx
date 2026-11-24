/**
 * The animated bead ring working mark — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * Reanimated drives the loop and rebuilds the path on the UI thread, so a working row never
 * re-renders per frame. The loop stops while its screen is covered, the app is not active, or
 * Reduce Motion is on, which shows the Mac's still design frame instead.
 */
import { NavigationContext } from "@react-navigation/native";
import { use, useEffect, useSyncExternalStore } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useAppActive, useReduceMotionEnabled } from "../src/lib/appState";
import {
  BEAD_RING_HALF_WIDTH,
  BEAD_RING_PERIOD,
  BEAD_RING_STILL_PROGRESS,
  beadRingEase,
  beadRingPath,
} from "./beadRing";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const STILL_PATH = beadRingPath(BEAD_RING_STILL_PROGRESS, 0);
const noSubscription = () => () => {};

/** Whether the screen hosting the mark is focused; marks outside a screen (overlays) count as on. */
function useHostScreenFocused(): boolean {
  const navigation = use(NavigationContext);
  return useSyncExternalStore(
    (onChange) => {
      if (!navigation) return noSubscription();
      const offFocus = navigation.addListener("focus", onChange);
      const offBlur = navigation.addListener("blur", onChange);
      return () => {
        offFocus();
        offBlur();
      };
    },
    () => navigation?.isFocused() ?? true,
  );
}

export function No3yBeadRing(props: { readonly color: string; readonly size: number }) {
  const focused = useHostScreenFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotionEnabled();
  const running = focused && appActive && !reduceMotion;
  const progress = useSharedValue(BEAD_RING_STILL_PROGRESS);

  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      progress.set(BEAD_RING_STILL_PROGRESS);
      return;
    }
    progress.set(0);
    progress.set(
      withRepeat(
        withTiming(1, { duration: BEAD_RING_PERIOD * 1000, easing: beadRingEase }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [running, progress]);

  const animatedProps = useAnimatedProps(() => ({ d: beadRingPath(progress.get()) }));

  return (
    <Svg width={props.size} height={props.size} viewBox="0 0 56 56">
      <AnimatedPath
        d={STILL_PATH}
        animatedProps={running ? animatedProps : undefined}
        stroke={props.color}
        strokeWidth={BEAD_RING_HALF_WIDTH * 2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
