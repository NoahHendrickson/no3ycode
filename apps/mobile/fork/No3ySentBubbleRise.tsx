/**
 * A sent message rises from the composer into place — `.fork/customizations.yaml#no3y-mobile-redesign`.
 * List rows mount in recycled containers the list hides until ready and places a moment later, and
 * the JS thread is busiest right after a send, so a UI-thread frame callback waits for the placed row.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { scheduleOnRN } from "react-native-worklets";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const RISE_MS = 300;
const FADE_MS = 150;

export function No3ySentBubbleRise(props: {
  /** Read at mount: the row is a message the user just sent. Later rows render in place. */
  readonly rise: boolean;
  /** The list shows its rows; the rise starts then, once. */
  readonly visible: boolean;
  /** The feed's bottom overlay height: the composer and the gap above it. */
  readonly composerInset: SharedValue<number>;
  /** KeyboardStickyView's `opened` offset: the composer rises by the keyboard less this. */
  readonly composerKeyboardOffset: number;
  readonly children: ReactNode;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // The composer rides the keyboard the way KeyboardStickyView moves it: height plus its offset.
  const keyboard = useReanimatedKeyboardAnimation();
  const ref = useAnimatedRef<Animated.View>();
  const [rises] = useState(props.rise);
  const faded = useRef(false);
  const opacity = useSharedValue(rises ? 0 : 1);
  const rise = useSharedValue(0);
  const started = useSharedValue(false);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: rise.get() }],
  }));
  const { composerInset, composerKeyboardOffset } = props;
  const [placed, setPlaced] = useState(!rises);
  const waiting = props.visible && !placed && !reduceMotion;
  const waitForPlacement = useFrameCallback(() => {
    "worklet";
    // Starts once on the UI thread; switching the callback off waits on the busy JS thread.
    if (started.get()) return;
    // A send that closes the keyboard moves the composer with it; measure once it settles.
    const keyboardProgress = keyboard.progress.get();
    if (keyboardProgress > 0 && keyboardProgress < 1) return;
    const layout = measure(ref);
    // The list parks a row above the screen until it places it.
    if (layout === null || layout.pageY < 0) return;
    started.set(true);
    const composerTop =
      windowHeight +
      keyboard.height.get() +
      keyboardProgress * composerKeyboardOffset -
      composerInset.get();
    const from = Math.max(0, composerTop - (layout.pageY + layout.height));
    rise.set(from);
    opacity.set(from > 0 ? 1 : withTiming(1, { duration: FADE_MS, easing: EASE_OUT }));
    rise.set(withTiming(0, { duration: RISE_MS, easing: EASE_OUT }));
    scheduleOnRN(setPlaced, true);
  }, false);
  useEffect(() => waitForPlacement.setActive(waiting), [waiting, waitForPlacement]);
  useEffect(() => {
    if (!rises || !reduceMotion || !props.visible || faded.current) return;
    faded.current = true;
    opacity.set(withTiming(1, { duration: FADE_MS, easing: EASE_OUT }));
  }, [rises, reduceMotion, props.visible, opacity]);
  return (
    <Animated.View ref={ref} style={style}>
      {props.children}
    </Animated.View>
  );
}
