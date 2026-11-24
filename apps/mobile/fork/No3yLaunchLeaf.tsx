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
  NO3Y_LAUNCH_FAN_MS,
  NO3Y_LAUNCH_GATHER_MS,
  NO3Y_LAUNCH_HOLD_MS,
  NO3Y_LAUNCH_OUTRO_MS,
  NO3Y_LAUNCH_SPIN_DELAY_MS,
} from "./no3yLaunch";

/**
 * The app icon's mark (assets/fork/app-icon.icon/Assets/mark.svg) on its 21-cell grid, as four
 * whole leaves: the halves the mark hides under a neighbour are mirrored from the visible half.
 */
const GRID = 21;
const OUTLINE = "#182E26";
/** Top, right, bottom, left: clockwise, the order they sit in around the centre. */
const LEAVES = [
  {
    outline:
      "M9 0h3v1h-3zM8 1h1v1h-1zM10 1h1v1h-1zM12 1h1v1h-1zM7 2h1v1h-1zM10 2h1v1h-1zM13 2h1v1h-1zM6 3h1v1h-1zM10 3h1v1h-1zM14 3h1v1h-1zM6 4h1v1h-1zM8 4h1v1h-1zM10 4h1v1h-1zM12 4h1v1h-1zM14 4h1v1h-1zM6 5h1v1h-1zM9 5h3v1h-3zM14 5h1v1h-1zM6 6h1v1h-1zM10 6h1v1h-1zM14 6h1v1h-1zM6 7h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1zM12 7h1v1h-1zM14 7h1v1h-1zM6 8h1v1h-1zM10 8h1v1h-1zM14 8h1v1h-1zM7 9h1v1h-1zM9 9h3v1h-3zM13 9h1v1h-1zM7 10h7v1h-7z",
    fill: [
      "#26B846",
      "M9 1h1v1h-1zM8 2h2v1h-2zM11 2h1v1h-1zM7 3h3v1h-3zM11 3h2v1h-2zM7 4h1v1h-1zM9 4h1v1h-1zM11 4h1v1h-1zM7 5h2v1h-2zM12 5h1v1h-1zM7 6h3v1h-3zM11 6h3v1h-3zM7 7h1v1h-1zM9 7h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM7 8h3v1h-3zM11 8h3v1h-3zM8 9h1v1h-1zM12 9h1v1h-1z",
    ],
    highlight: ["#3AED62", "M11 1h1v1h-1zM12 2h1v1h-1zM13 3h1v1h-1zM13 4h1v1h-1zM13 5h1v1h-1z"],
  },
  {
    outline:
      "M12 6h6v1h-6zM10 7h2v1h-2zM18 7h1v1h-1zM10 8h1v1h-1zM13 8h1v1h-1zM16 8h1v1h-1zM19 8h1v1h-1zM10 9h2v1h-2zM15 9h1v1h-1zM20 9h1v1h-1zM10 10h11v1h-11zM10 11h2v1h-2zM15 11h1v1h-1zM20 11h1v1h-1zM10 12h1v1h-1zM13 12h1v1h-1zM16 12h1v1h-1zM19 12h1v1h-1zM10 13h2v1h-2zM18 13h1v1h-1zM12 14h6v1h-6z",
    fill: [
      "#F95B1C",
      "M12 7h6v1h-6zM11 8h2v1h-2zM14 8h2v1h-2zM17 8h2v1h-2zM12 9h3v1h-3zM16 9h4v1h-4zM12 11h3v1h-3zM16 11h3v1h-3zM11 12h2v1h-2zM14 12h2v1h-2zM17 12h1v1h-1zM12 13h3v1h-3z",
    ],
    highlight: ["#FF8F0C", "M19 11h1v1h-1zM18 12h1v1h-1zM15 13h3v1h-3z"],
  },
  {
    outline:
      "M7 10h7v1h-7zM7 11h1v1h-1zM9 11h3v1h-3zM13 11h1v1h-1zM6 12h1v1h-1zM10 12h1v1h-1zM14 12h1v1h-1zM6 13h1v1h-1zM8 13h1v1h-1zM10 13h1v1h-1zM12 13h1v1h-1zM14 13h1v1h-1zM6 14h1v1h-1zM10 14h1v1h-1zM14 14h1v1h-1zM6 15h1v1h-1zM9 15h3v1h-3zM14 15h1v1h-1zM6 16h1v1h-1zM8 16h1v1h-1zM10 16h1v1h-1zM12 16h1v1h-1zM14 16h1v1h-1zM6 17h1v1h-1zM10 17h1v1h-1zM14 17h1v1h-1zM7 18h1v1h-1zM10 18h1v1h-1zM13 18h1v1h-1zM8 19h1v1h-1zM10 19h1v1h-1zM12 19h1v1h-1zM9 20h3v1h-3z",
    fill: [
      "#FCB01A",
      "M8 11h1v1h-1zM12 11h1v1h-1zM7 12h3v1h-3zM11 12h3v1h-3zM7 13h1v1h-1zM9 13h1v1h-1zM11 13h1v1h-1zM13 13h1v1h-1zM7 14h3v1h-3zM11 14h3v1h-3zM8 15h1v1h-1zM12 15h2v1h-2zM9 16h1v1h-1zM11 16h1v1h-1zM13 16h1v1h-1zM8 17h2v1h-2zM11 17h3v1h-3zM9 18h1v1h-1zM11 18h2v1h-2zM11 19h1v1h-1z",
    ],
    highlight: ["#FFD233", "M7 15h1v1h-1zM7 16h1v1h-1zM7 17h1v1h-1zM8 18h1v1h-1zM9 19h1v1h-1z"],
  },
  {
    outline:
      "M3 6h6v1h-6zM2 7h1v1h-1zM9 7h2v1h-2zM1 8h1v1h-1zM4 8h1v1h-1zM7 8h1v1h-1zM10 8h1v1h-1zM0 9h1v1h-1zM5 9h1v1h-1zM0 10h11v1h-11zM0 11h1v1h-1zM5 11h1v1h-1zM8 11h1v1h-1zM1 12h1v1h-1zM4 12h1v1h-1zM7 12h1v1h-1zM10 12h1v1h-1zM2 13h1v1h-1zM9 13h2v1h-2zM3 14h6v1h-6z",
    fill: [
      "#008755",
      "M6 7h3v1h-3zM3 8h1v1h-1zM5 8h2v1h-2zM8 8h2v1h-2zM2 9h3v1h-3zM6 9h5v1h-5zM1 11h4v1h-4zM6 11h2v1h-2zM9 11h2v1h-2zM2 12h2v1h-2zM5 12h2v1h-2zM8 12h2v1h-2zM3 13h6v1h-6z",
    ],
    highlight: ["#08B776", "M3 7h3v1h-3zM2 8h1v1h-1zM1 9h1v1h-1z"],
  },
] as const;
/** The one stacking of whole leaves that reproduces the logo : top under left, right under top. */
const DRAW_ORDER = [2, 1, 0, 3] as const;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const GATHERED_SCALE = 0.82;

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
            withTiming(1, { duration: NO3Y_LAUNCH_GATHER_MS, easing: EASE_IN_OUT }),
            withTiming(2, { duration: NO3Y_LAUNCH_FAN_MS, easing: EASE_OUT }),
            withTiming(2, { duration: NO3Y_LAUNCH_HOLD_MS }),
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
      outroScale.set(withTiming(1.12, { duration: NO3Y_LAUNCH_OUTRO_MS, easing: EASE_OUT }));
    }
  }, [ready, opacity, outroScale, reduceMotion, onDone]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const markStyle = useAnimatedStyle(() => {
    const t = spin.get();
    const gathered = t <= 1 ? t : 2 - t;
    return { transform: [{ scale: (1 - (1 - GATHERED_SCALE) * gathered) * outroScale.get() }] };
  });
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
        {DRAW_ORDER.map((index) => (
          <Leaf key={index} index={index} size={size} spin={spin} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function Leaf(props: {
  readonly index: number;
  readonly size: number;
  readonly spin: SharedValue<number>;
}) {
  const { index, size, spin } = props;
  const leaf = LEAVES[index]!;
  // Each leaf sweeps clockwise to the top (the top leaf stays), then fans out clockwise from there.
  const gatherTurn = ((4 - index) % 4) * 90;
  const fanTurn = -index * 90;
  const style = useAnimatedStyle(() => {
    const t = spin.get();
    const turn = t <= 1 ? gatherTurn * t : fanTurn * (2 - t);
    return { transform: [{ rotate: `${turn}deg` }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
        <Path d={leaf.outline} fill={OUTLINE} />
        <Path d={leaf.fill[1]} fill={leaf.fill[0]} />
        <Path d={leaf.highlight[1]} fill={leaf.highlight[0]} />
      </Svg>
    </Animated.View>
  );
}
