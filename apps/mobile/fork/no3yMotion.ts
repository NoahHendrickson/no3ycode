/**
 * no3y iOS motion presets (`.fork/customizations.yaml#no3y-mobile-redesign`): short, eased-out,
 * UI-thread, retargetable, instant under Reduce Motion. Never fade a view holding glass: a
 * UIGlassEffect installed under a fading ancestor never renders. Glass moves by transform only.
 */
import { useEffect } from "react";
import {
  Easing,
  FadeIn,
  FadeOut,
  Keyframe,
  LinearTransition,
  ReduceMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const EASE_OUT = Easing.out(Easing.cubic);

/** Rows and tiles sliding into the room another left, or out of the way of a new one. */
export const NO3Y_LAYOUT = LinearTransition.duration(200)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);

/** Something arriving in place: a row, a pill, a sheet's content. */
export const NO3Y_FADE_IN = FadeIn.duration(180).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

/** Something leaving: a little quicker than it came. */
export const NO3Y_FADE_OUT = FadeOut.duration(140).reduceMotion(ReduceMotion.System);

/** A glass card or banner rising 8pt into place, by transform alone. */
export const NO3Y_GLASS_RISE_IN = new Keyframe({
  0: { transform: [{ translateY: 8 }, { scale: 0.98 }] },
  100: { transform: [{ translateY: 0 }, { scale: 1 }], easing: EASE_OUT },
})
  .duration(200)
  .reduceMotion(ReduceMotion.System);

/** A glass pill growing into place from 92%, by transform alone. */
export const NO3Y_GLASS_IN = new Keyframe({
  0: { transform: [{ scale: 0.92 }] },
  100: { transform: [{ scale: 1 }], easing: EASE_OUT },
})
  .duration(180)
  .reduceMotion(ReduceMotion.System);

/** 0 → 1 as `on` turns true, eased over 180ms on the UI thread (a chevron, a selection). */
export function useNo3yToggleProgress(on: boolean) {
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    progress.set(
      withTiming(on ? 1 : 0, {
        duration: 180,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [on, progress]);
  return progress;
}
