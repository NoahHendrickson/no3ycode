// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#no3y-voice-prepare-cache`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

function read(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("no3y-voice-prepare-cache", () => {
  it("routes the mobile transcriber's prepare through the cache and warms it from the mic", () => {
    const destination = read("../../../mobile/src/features/voice-input/voiceDestination.ts");
    const dictation = read("../../../mobile/src/features/voice-input/ComposerDictationControl.tsx");
    expect(destination).toContain("const voicePrepareCache = createVoicePrepareCache<string>();");
    expect(destination).toContain(
      "voicePrepareCache.read(prepared, destinationKey, prepareDestination, signal)",
    );
    expect(dictation).toContain("useVoicePreparePrefetch(props.isAvailable);");
  });
});
