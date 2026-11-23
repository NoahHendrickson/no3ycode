/**
 * The no3y iOS motion presets — see `.fork/customizations.yaml#no3y-mobile-redesign`: short,
 * eased-out, UI-thread Reanimated animations that a new change retargets mid-flight, and that
 * Reduce Motion turns into instant changes (ReduceMotion.System).
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

/** A floating card or banner rising 8pt into place as it fades in. */
export const NO3Y_RISE_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 8 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
})
  .duration(200)
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
