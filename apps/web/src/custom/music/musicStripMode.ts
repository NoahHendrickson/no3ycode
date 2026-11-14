/**
 * Whether the music strip above the sidebar footer shows, and whether it is expanded into the
 * library: a per-device preference. See .fork/customizations.yaml#fork-music-panel.
 */
import { Schema } from "effect";

import { useLocalStorage, writeLocalStorageValue } from "~/hooks/useLocalStorage";

const STORAGE_KEY = "t3code:fork-music-strip";
const MusicStripMode = Schema.Literals(["closed", "open", "expanded"]);
type MusicStripMode = typeof MusicStripMode.Type;

export const useMusicStripMode = (): MusicStripMode =>
  useLocalStorage(STORAGE_KEY, "closed", MusicStripMode)[0];

export const setMusicStripMode = (next: MusicStripMode): void =>
  writeLocalStorageValue(STORAGE_KEY, next, "closed", MusicStripMode);
