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

/** The actions of ah ahh's remote API this panel sends; ah ahh validates each one. */
export type MusicCommand =
  | { readonly action: "toggle" | "next" | "previous" }
  | { readonly action: "volume" | "jumpTo"; readonly value: number }
  | {
      readonly action: "playItem";
      readonly value: {
        readonly type: "library-playlists";
        readonly id: string;
        readonly startWith: number;
      };
    }
  | {
      readonly action: "playSongs";
      readonly value: { readonly ids: ReadonlyArray<string>; readonly startWith: number };
    };

export type MusicRequest =
  | { readonly type: "follow" | "unfollow" | "queue" | "open" }
  | ({ readonly type: "command" } & MusicCommand)
  | {
      readonly type: "music";
      readonly path: string;
      readonly params?: Readonly<Record<string, string | number>>;
    };

export interface MusicBridge {
  /** Whether the desktop can start ah ahh itself. Asking it to answers `{ ok }` once ah ahh is up. */
  readonly canOpen: boolean;
  /** Answers are ah ahh's own JSON, or a `closed`/`error` state; the store reads them defensively. */
  readonly request: (request: MusicRequest) => Promise<unknown>;
  /** ah ahh's player state, pushed while this window follows it. */
  readonly onState: (listener: (state: unknown) => void) => () => void;
}

export function readMusicBridge(): MusicBridge | null {
  const bridge = (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
  if (typeof bridge !== "object" || bridge === null) return null;
  const candidate = (bridge as { music?: unknown }).music;
  if (typeof candidate !== "object" || candidate === null) return null;
  const { request, onState } = candidate as { request?: unknown; onState?: unknown };
  return typeof request === "function" && typeof onState === "function"
    ? (candidate as MusicBridge)
    : null;
}
