/**
 * Warms the voice destination's prepare cache while the composer's mic is showing — see
 * `.fork/customizations.yaml#no3y-voice-prepare-cache` — so a tap starts recording without
 * waiting on the environment.
 */
import { useEffect } from "react";

import { prefetchVoicePrepare } from "../src/features/voice-input/voiceDestination";

export function useVoicePreparePrefetch(available: boolean) {
  // Starts the speech-status fetch the next dictation tap would otherwise wait on.
  useEffect(() => {
    if (available) prefetchVoicePrepare();
  }, [available]);
}
