/**
 * A sent message rises from the composer into place — `.fork/customizations.yaml#no3y-mobile-redesign`.
 * List rows mount in recycled containers the list hides until ready and places a moment later, and
 * the JS thread is busiest right after a send, so a UI-thread frame callback waits for the placed row.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
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
import { scheduleOnRN } from "react-native-worklets";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const RISE_MS = 300;
const FADE_MS = 150;
/** About 1.5s at 60Hz: a row still unplaced by then is revealed where it stands. */
const PLACEMENT_FRAMES = 90;

// Messages that already rose this session, so a row remounting (scrolled back, thread reopened,
// still pending offline) renders in place instead of rising again.
const risen = new Set<string>();

interface RiseProps {
  readonly messageId: string;
  /** The list shows its rows; the rise starts then, once. */
  readonly visible: boolean;
  /** The feed's bottom overlay height: the composer and the gap above it. */
  readonly composerInset: SharedValue<number>;
  /** KeyboardStickyView's `opened` offset: the composer rises by the keyboard less this. */
  readonly composerKeyboardOffset: number;
  readonly children: ReactNode;
}

/** Decided at mount, so the row keeps one shape; history pays nothing for the animation. */
export function No3ySentBubbleRise(props: RiseProps & { readonly rise: boolean }) {
  const [rises] = useState(() => props.rise && !risen.has(props.messageId));
  return rises ? <RisingBubble {...props} /> : props.children;
}

function RisingBubble(props: RiseProps) {
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // The composer rides the keyboard the way KeyboardStickyView moves it: height plus its offset.
  const keyboard = useReanimatedKeyboardAnimation();
  const ref = useAnimatedRef<Animated.View>();
  const faded = useRef(false);
  const opacity = useSharedValue(0);
  const rise = useSharedValue(0);
  const started = useSharedValue(false);
  const framesWaited = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: rise.get() }],
  }));
  const { composerInset, composerKeyboardOffset, messageId } = props;
  const [placed, setPlaced] = useState(false);
  const waiting = props.visible && !placed && !reduceMotion;
  useEffect(() => {
    risen.add(messageId);
  }, [messageId]);
  const waitForPlacement = useFrameCallback(() => {
    "worklet";
    // Starts once on the UI thread; switching the callback off waits on the busy JS thread.
    if (started.get()) return;
    framesWaited.set(framesWaited.get() + 1);
    const layout = measure(ref);
    // A send that closes the keyboard moves the composer with it; measure once it settles.
    const keyboardProgress = keyboard.progress.get();
    const settled = !(keyboardProgress > 0 && keyboardProgress < 1);
    // The list parks an unplaced row wholly above the screen; a tall placed row only its top.
    const placedRow = layout !== null && layout.pageY + layout.height > 0;
    if (!(settled && placedRow) && framesWaited.get() < PLACEMENT_FRAMES) return;
    started.set(true);
    const composerTop =
      windowHeight +
      keyboard.height.get() +
      keyboardProgress * composerKeyboardOffset -
      composerInset.get();
    const from =
      layout !== null && placedRow ? Math.max(0, composerTop - (layout.pageY + layout.height)) : 0;
    rise.set(from);
    opacity.set(from > 0 ? 1 : withTiming(1, { duration: FADE_MS, easing: EASE_OUT }));
    rise.set(withTiming(0, { duration: RISE_MS, easing: EASE_OUT }));
    scheduleOnRN(setPlaced, true);
  }, false);
  useEffect(() => waitForPlacement.setActive(waiting), [waiting, waitForPlacement]);
  useEffect(() => {
    if (!reduceMotion || !props.visible || faded.current) return;
    faded.current = true;
    opacity.set(withTiming(1, { duration: FADE_MS, easing: EASE_OUT }));
  }, [reduceMotion, props.visible, opacity]);
  return (
    <Animated.View ref={ref} style={style}>
      {props.children}
    </Animated.View>
  );
}
