/**
 * The no3y launch animation (`.fork/customizations.yaml#no3y-launch-sparkle`): the native splash's
 * green sparkle twinkles (a squeeze, a spring back, a glint across it) on the UI thread, then scales
 * up and fades as the first screen shows. It hides the native splash on its first frame and ends
 * as soon as the app is ready, so it never holds the launch. Cold launch only; Reduce Motion fades.
 */
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Platform, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { ClipPath, Defs, G, Path, Rect } from "react-native-svg";

import { NO3Y_SPLASH_BACKGROUND, NO3Y_SPLASH_IMAGE_WIDTH } from "./identity";
import { createNo3yLaunchGate, NO3Y_LAUNCH_OUTRO_MS, no3yLaunchOutroAt } from "./no3yLaunch";

const SPARKLE_PATH =
  "M407.129 346.602C412.155 320.586 425.468 299.496 448.091 299.496C470.714 299.496 484.027 320.586 489.053 346.604C494.97 377.228 501.314 402.237 509.271 422.891C562.815 561.884 711.025 559.898 757.557 488.814C765.111 477.275 770.697 462.828 775.464 444.323C780.034 426.587 787.968 412.209 803.393 412.209C818.818 412.209 826.751 426.59 831.323 444.331C844.754 496.46 864.683 516.387 916.816 529.818C934.552 534.388 948.93 542.322 948.93 557.747C948.93 573.172 934.549 581.105 916.807 585.677C880.661 594.99 859.997 607.428 846.247 631.559C834.931 651.417 807.621 715.48 830.745 761.996C840.112 780.838 854.411 790.078 880.805 796.878C892.912 799.998 902.727 805.413 902.727 815.941C902.727 826.469 892.912 831.884 880.804 835.004C845.223 844.171 831.622 857.773 822.455 893.354C819.335 905.461 813.92 915.275 803.392 915.275C792.864 915.275 787.449 905.46 784.329 893.352C775.162 857.773 761.561 844.171 725.981 835.004C713.873 831.884 704.058 826.469 704.058 815.941C704.058 805.413 713.872 799.998 725.979 796.878C752.373 790.078 766.673 780.838 776.039 761.996C799.164 715.48 771.853 651.417 760.538 631.559C759.579 629.876 758.587 628.25 757.557 626.678C711.025 555.594 562.815 553.609 509.271 692.601C501.314 713.255 494.97 738.264 489.053 768.888C484.027 794.906 470.714 815.996 448.091 815.996C425.468 815.996 412.155 794.907 407.129 768.89C386.145 660.277 359.777 622.297 275.205 598.708C249.188 591.452 228.099 580.369 228.099 557.746C228.099 535.123 249.189 524.04 275.206 516.784C359.777 493.195 386.145 455.216 407.129 346.602Z";
const VIEW_WIDTH = 1155;
const VIEW_HEIGHT = 1149;
const SPARKLE_GREEN = "#00C26B";
const GLINT_WIDTH = 150;

const gate = createNo3yLaunchGate();

/** Called when the app's first screen is ready (where the native splash used to hide). */
export const markNo3yLaunchReady = gate.markReady;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// The native splash only shows the sparkle in the no3y build on an iPhone.
const PLAYS =
  Platform.OS === "ios" &&
  !Platform.isPad &&
  (Constants.expoConfig?.ios?.bundleIdentifier ?? "").includes("no3ycode");

export function No3yLaunchSparkle() {
  const [playing] = useState(() => PLAYS && gate.claim());
  const [done, setDone] = useState(false);
  if (!playing || done) return null;
  return <LaunchOverlay onDone={setDone} />;
}

function LaunchOverlay(props: { readonly onDone: (done: true) => void }) {
  const reduceMotion = useReducedMotion();
  const ready = useSyncExternalStore(gate.subscribe, gate.ready);
  const mountedAt = useRef(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const glint = useSharedValue(-GLINT_WIDTH * 2);
  const opacity = useSharedValue(1);
  const outroScale = useSharedValue(1);

  // Hides the native splash under its twin and starts the twinkle on the UI thread.
  useEffect(() => {
    mountedAt.current = Date.now();
    void SplashScreen.hide();
    if (reduceMotion) return;
    scale.set(
      withSequence(
        withTiming(0.86, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 9, stiffness: 180, mass: 0.7 }),
      ),
    );
    rotation.set(
      withSequence(
        withTiming(-12, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 10, stiffness: 160 }),
      ),
    );
    glint.set(
      withDelay(
        180,
        withTiming(VIEW_WIDTH + GLINT_WIDTH, { duration: 420, easing: Easing.inOut(Easing.quad) }),
      ),
    );
  }, [reduceMotion, scale, rotation, glint]);

  const { onDone } = props;
  // Starts the UI-thread outro once the first screen is ready.
  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - mountedAt.current;
    const delay = Math.max(0, no3yLaunchOutroAt(elapsed) - elapsed);
    const finish = () => onDone(true);
    opacity.set(
      withDelay(
        delay,
        withTiming(
          0,
          { duration: NO3Y_LAUNCH_OUTRO_MS, easing: Easing.in(Easing.quad) },
          (finished) => {
            if (finished) runOnJS(finish)();
          },
        ),
      ),
    );
    if (!reduceMotion) {
      outroScale.set(withDelay(delay, withTiming(1.18, { duration: NO3Y_LAUNCH_OUTRO_MS })));
    }
  }, [ready, opacity, outroScale, reduceMotion, onDone]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() * outroScale.get() }, { rotate: `${rotation.get()}deg` }],
  }));
  const glintProps = useAnimatedProps(() => ({ x: glint.get() }));
  const width = NO3Y_SPLASH_IMAGE_WIDTH;
  const height = (width * VIEW_HEIGHT) / VIEW_WIDTH;
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
      <Animated.View style={[{ width, height }, markStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
          <Defs>
            <ClipPath id="no3y-launch-mark">
              <Path d={SPARKLE_PATH} />
            </ClipPath>
          </Defs>
          <Path d={SPARKLE_PATH} fill={SPARKLE_GREEN} />
          <G clipPath="url(#no3y-launch-mark)">
            <G transform={`rotate(24 ${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2})`}>
              <AnimatedRect
                animatedProps={glintProps}
                y={-VIEW_HEIGHT}
                width={GLINT_WIDTH}
                height={VIEW_HEIGHT * 3}
                fill="#FFFFFF"
                opacity={0.55}
              />
            </G>
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
