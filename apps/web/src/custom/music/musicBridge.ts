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
      /** The song's length, and where it was at `positionAt` (epoch ms, the desktop's clock). */
      readonly durationMs: number;
      readonly positionMs: number;
      readonly positionAt: number;
      /** 0 to 1. */
      readonly volume: number;
      readonly shuffle: boolean;
      readonly repeat: MusicRepeat;
      /** Bumped by ah ahh whenever its queue changes. */
      readonly queueRevision: number;
    };

/** 0 off, 1 the one song, 2 the whole queue: ah ahh's (and MusicKit's) values. */
export type MusicRepeat = 0 | 1 | 2;

/** A row of a library listing: a song, playlist, artist or album (the last three have no artist). */
export interface MusicRow {
  readonly id: string;
  readonly name: string;
  readonly artist: string;
  /** An Apple `{w}x{h}` cover template; see `sizedArtwork`. */
  readonly artwork: string | null;
}

export interface MusicQueueEntry {
  /** Its place in ah ahh's queue, which is what jumping to it takes. */
  readonly index: number;
  readonly title: string;
  readonly artist: string;
  /** A 120px cover URL. */
  readonly artwork: string | null;
}

/** The actions of ah ahh's remote API this panel sends; ah ahh validates each one. */
export type MusicCommand =
  | { readonly action: "toggle" | "next" | "previous" }
  | { readonly action: "volume" | "jumpTo"; readonly value: number }
  /** To a point in the song, in seconds. */
  | { readonly action: "seek"; readonly value: number }
  | { readonly action: "shuffle"; readonly value: boolean }
  | { readonly action: "repeat"; readonly value: MusicRepeat }
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
    /** Rows per page; 100 when left out. */
    limit?: number,
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

/** An Apple cover template at `px` square; JPEG, since the panel draws nothing over it. */
export const sizedArtwork = (template: string, px: number): string =>
  template.replace("{w}", String(px)).replace("{h}", String(px)).replace("{f}", "jpg");
