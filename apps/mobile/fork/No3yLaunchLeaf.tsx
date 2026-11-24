/**
 * The no3y launch animation (`.fork/customizations.yaml#no3y-launch-leaf`). It must never hold
 * the launch: it fades the moment the app is ready, and spins only while the app still loads.
 */
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Platform, StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { NO3Y_SPLASH_BACKGROUND, NO3Y_SPLASH_IMAGE_WIDTH } from "./identity";
import {
  createNo3yLaunchGate,
  NO3Y_LAUNCH_OUTRO_MS,
  NO3Y_LAUNCH_SPIN_DELAY_MS,
} from "./no3yLaunch";
import { NO3Y_LEAF_GRID, NO3Y_LEAVES, type No3yLeaf } from "./no3yLeafMark";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/** The leaves sweep clockwise into one stack at the top… */
const GATHER_MS = 320;
/** …fan back out clockwise into the mark… */
const FAN_MS = 560;
/** …and rest whole before the next spin. */
const HOLD_MS = 420;
const GATHERED_SCALE = 0.82;
const OUTRO_SCALE = 1.12;

const gate = createNo3yLaunchGate();

/** Called when the app's first screen is ready (where the native splash used to hide). */
export const markNo3yLaunchReady = gate.markReady;

// The native splash only shows the leaf in the no3y build on an iPhone.
const PLAYS =
  Platform.OS === "ios" &&
  !Platform.isPad &&
  (Constants.expoConfig?.ios?.bundleIdentifier ?? "").includes("no3ycode");

export function No3yLaunchLeaf() {
  const [playing] = useState(() => PLAYS && gate.claim());
  const [done, setDone] = useState(false);
  if (!playing || done) return null;
  return <LaunchOverlay onDone={setDone} />;
}

function LaunchOverlay(props: { readonly onDone: (done: true) => void }) {
  const reduceMotion = useReducedMotion();
  const ready = useSyncExternalStore(gate.subscribe, gate.ready);
  // 0 → 1 gathers the leaves into a stack at the top, 1 → 2 fans them back out.
  const spin = useSharedValue(0);
  const opacity = useSharedValue(1);
  const outroScale = useSharedValue(1);

  // Hides the native splash under its twin, then spins only if the app is still loading.
  useEffect(() => {
    void SplashScreen.hide();
    if (reduceMotion) return;
    const timer = setTimeout(() => {
      if (gate.ready()) return;
      spin.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: GATHER_MS, easing: EASE_IN_OUT }),
            withTiming(2, { duration: FAN_MS, easing: EASE_OUT }),
            withTiming(2, { duration: HOLD_MS }),
            withTiming(0, { duration: 0 }),
          ),
          -1,
        ),
      );
    }, NO3Y_LAUNCH_SPIN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion, spin]);

  const { onDone } = props;
  // Fades out as soon as the first screen is ready; a spin already under way plays on beneath it.
  useEffect(() => {
    if (!ready) return;
    const finish = () => onDone(true);
    opacity.set(
      withTiming(0, { duration: NO3Y_LAUNCH_OUTRO_MS, easing: EASE_OUT }, (finished) => {
        if (finished) scheduleOnRN(finish);
      }),
    );
    if (!reduceMotion) {
      outroScale.set(withTiming(OUTRO_SCALE, { duration: NO3Y_LAUNCH_OUTRO_MS, easing: EASE_OUT }));
    }
  }, [ready, opacity, outroScale, reduceMotion, onDone]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(spin.get(), [0, 1, 2], [1, GATHERED_SCALE, 1]) * outroScale.get() },
    ],
  }));
  const size = NO3Y_SPLASH_IMAGE_WIDTH;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 1000,
          backgroundColor: NO3Y_SPLASH_BACKGROUND,
          alignItems: "center",
          justifyContent: "center",
        },
        overlayStyle,
      ]}
    >
      <Animated.View style={[{ width: size, height: size }, markStyle]}>
        {NO3Y_LEAVES.map((leaf) => (
          <Leaf key={leaf.quarter} leaf={leaf} size={size} spin={spin} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function Leaf(props: {
  readonly leaf: No3yLeaf;
  readonly size: number;
  readonly spin: SharedValue<number>;
}) {
  const { leaf, size, spin } = props;
  // Each leaf laps once clockwise: up to the stack at the top, then on round to its place.
  const gatherTurn = ((4 - leaf.quarter) % 4) * 90;
  const lap = gatherTurn === 0 ? 0 : 360;
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(spin.get(), [0, 1, 2], [0, gatherTurn, lap])}deg` }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${NO3Y_LEAF_GRID} ${NO3Y_LEAF_GRID}`}>
        {leaf.layers.map((layer) => (
          <Path key={layer.color} d={layer.d} fill={layer.color} />
        ))}
      </Svg>
    </Animated.View>
  );
}
