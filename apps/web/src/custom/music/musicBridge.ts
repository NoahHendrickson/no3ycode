/**
 * The music panel's half of the fork desktop bridge (`music` in apps/desktop/src/preload.ts),
 * read off `globalThis` so it stays testable. Only the desktop app has it, so a null bridge
 * is the whole availability check. See .fork/customizations.yaml#fork-music-panel.
 */

/** `closed`: ah ahh is not running on this computer. `error`: it answered, but not usefully. */
export type MusicState =
  | { readonly status: "closed" | "error" }
  | {
      readonly status: "ready";
      readonly playing: boolean;
      /** Null with nothing loaded in the player. */
      readonly title: string | null;
      readonly artist: string;
      readonly album: string;
      readonly artwork: string | null;
      /** 0 to 1. */
      readonly volume: number;
      /** Bumped by ah ahh whenever its queue changes. */
      readonly queueRevision: number;
    };

/** A row of a library listing: a song, or a playlist (which has no artist). */
export interface MusicRow {
  readonly id: string;
  readonly name: string;
  readonly artist: string;
}

export interface MusicQueueEntry {
  /** Its place in ah ahh's queue, which is what jumping to it takes. */
  readonly index: number;
  readonly title: string;
  readonly artist: string;
}

/** The actions of ah ahh's remote API this panel sends; ah ahh validates each one. */
export type MusicCommand =
  | { readonly action: "toggle" | "next" | "previous" }
  | { readonly action: "volume" | "jumpTo"; readonly value: number }
  | {
      readonly action: "playSongs";
      readonly value: { readonly ids: ReadonlyArray<string>; readonly startWith: number };
    };

/** The desktop has already checked ah ahh's answers; a failed call answers false or null. */
export interface MusicBridge {
  /** Whether the desktop can start ah ahh itself. */
  readonly canOpen: boolean;
  /** ah ahh's player state, until the returned function is called. */
  readonly follow: (listener: (state: MusicState) => void) => () => void;
  /** True once ah ahh's player answers, starting it first where the desktop can. */
  readonly open: () => Promise<boolean>;
  readonly command: (command: MusicCommand) => Promise<boolean>;
  /** ah ahh's queue after the playing song. */
  readonly upNext: () => Promise<ReadonlyArray<MusicQueueEntry> | null>;
  /** One page of an Apple Music library listing; `nextOffset` is null on the last. */
  readonly libraryPage: (
    path: string,
    offset: number,
  ) => Promise<{
    readonly rows: ReadonlyArray<MusicRow>;
    readonly nextOffset: number | null;
  } | null>;
}

export function readMusicBridge(): MusicBridge | null {
  const bridge = (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
  if (typeof bridge !== "object" || bridge === null) return null;
  const candidate = (bridge as { music?: unknown }).music;
  if (typeof candidate !== "object" || candidate === null) return null;
  return typeof (candidate as { follow?: unknown }).follow === "function"
    ? (candidate as MusicBridge)
    : null;
}
