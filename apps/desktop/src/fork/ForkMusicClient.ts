// @effect-diagnostics nodeBuiltinImport:off
// @effect-diagnostics globalTimers:off -- The bounded wait for a launching ah ahh runs outside any Effect fiber.
// @effect-diagnostics globalFetch:off -- Plain promises on purpose: this runs outside any Effect runtime, from a shell or a test.
/**
 * The client for ah ahh's remote API (its electron/remote.js), which the music panel drives.
 * ah ahh's JSON is checked here, once, so everything past this file is typed. Free of
 * Electron so it can run against a real ah ahh. See .fork/customizations.yaml#fork-music-panel.
 */
import * as NodeFSP from "node:fs/promises";

import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export interface ForkMusicTarget {
  /** ah ahh's remote server, always up on loopback while it runs. */
  readonly origin: string;
  /** `remote.json` in ah ahh's data folder: the pairing token, readable only by the user. */
  readonly tokenFile: string;
}

const Player = Schema.Struct({
  playing: Schema.Boolean,
  /** Null with nothing loaded in the player. */
  title: Schema.NullOr(Schema.String),
  artist: Schema.String,
  album: Schema.String,
  artwork: Schema.NullOr(Schema.String),
  /** The song's length, and where it was when ah ahh sent this. */
  durationMs: Schema.Number,
  positionMs: Schema.Number,
  /** 0 to 1. */
  volume: Schema.Number,
  shuffle: Schema.Boolean,
  /** 0 off, 1 the one song, 2 the whole queue. */
  repeat: Schema.Literals([0, 1, 2]),
  /** Bumped by ah ahh whenever its queue changes. */
  queueRevision: Schema.Number,
});

/** Within this, a heartbeat's position is where the song was already known to be. */
const POSITION_TOLERANCE_MS = 1500;

/** `closed`: ah ahh is not running, or has never run. `error`: it answered, but not usefully. */
export type ForkMusicState =
  | { readonly status: "closed" | "error" }
  | ({ readonly status: "ready" } & typeof Player.Type);

const Queue = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      index: Schema.Number,
      title: Schema.String,
      artist: Schema.String,
      /** A 120px cover on Apple's CDN; older ah ahh builds leave it out. */
      artwork: Schema.optionalKey(Schema.NullOr(Schema.String)),
    }),
  ),
});
export type ForkMusicQueueEntry = (typeof Queue.Type)["items"][number];

/** An Apple Music API listing, as ah ahh relays it. */
const Listing = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      attributes: Schema.Struct({
        name: Schema.String,
        artistName: Schema.optional(Schema.String),
        // An Apple `{w}x{h}` template; playlists the user made have none.
        artwork: Schema.optional(Schema.Struct({ url: Schema.String })),
      }),
    }),
  ),
  next: Schema.optional(Schema.String),
});

export interface ForkMusicLibraryPage {
  readonly rows: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly artist: string;
    readonly artwork: string | null;
  }>;
  /** Where the next page starts, or null on the last one. */
  readonly nextOffset: number | null;
}

/** Apple's largest page. */
const LIBRARY_PAGE_SIZE = 100;

const decodePlayer = Schema.decodeUnknownOption(Player);
const decodeQueue = Schema.decodeUnknownOption(Queue);
const decodeListing = Schema.decodeUnknownOption(Listing);

/**
 * An authorized request to ah ahh. Null when there is no pairing token, which means ah ahh
 * has never run here; a refused connection throws, which means it is not running now. The
 * token is read per call, since ah ahh's Reset pairing replaces it.
 */
async function call(
  target: ForkMusicTarget,
  path: string,
  init: { readonly body?: unknown; readonly signal?: AbortSignal } = {},
): Promise<Response | null> {
  let token: unknown;
  try {
    ({ token } = JSON.parse(await NodeFSP.readFile(target.tokenFile, "utf8")) as {
      token?: unknown;
    });
  } catch {
    return null;
  }
  if (typeof token !== "string" || token === "") return null;
  return fetch(`${target.origin}${path}`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(init.body === undefined ? {} : { method: "POST", body: JSON.stringify(init.body) }),
    ...(init.signal === undefined ? {} : { signal: init.signal }),
  });
}

/** Whether ah ahh took the command; it validates each one itself. */
export async function commandForkMusic(
  target: ForkMusicTarget,
  command: { readonly action: string; readonly value?: unknown },
): Promise<boolean> {
  try {
    return (await call(target, "/v1/command", { body: command }))?.ok === true;
  } catch {
    return false;
  }
}

/** ah ahh's queue after the playing song, or null when it could not be read. */
export async function upNextForkMusic(
  target: ForkMusicTarget,
): Promise<ReadonlyArray<ForkMusicQueueEntry> | null> {
  try {
    const response = await call(target, "/v1/queue");
    if (response?.ok !== true) return null;
    // The first entry is the song playing.
    return Option.getOrNull(decodeQueue(await response.json()))?.items.slice(1) ?? null;
  } catch {
    return null;
  }
}

/** One page of a library listing (playlists, a playlist's tracks, songs), or null when it failed. */
export async function libraryPageForkMusic(
  target: ForkMusicTarget,
  path: string,
  offset: number,
  limit = LIBRARY_PAGE_SIZE,
): Promise<ForkMusicLibraryPage | null> {
  try {
    const response = await call(target, "/v1/music", {
      body: { path, params: { limit, offset } },
    });
    // Apple answers 404 for an empty playlist's tracks.
    if (response?.status === 404) return { rows: [], nextOffset: null };
    if (response?.ok !== true) return null;
    const listing = Option.getOrNull(decodeListing(await response.json()));
    if (listing === null) return null;
    return {
      rows: listing.data.map((row) => ({
        id: row.id,
        name: row.attributes.name,
        artist: row.attributes.artistName ?? "",
        artwork: row.attributes.artwork?.url.startsWith("https://")
          ? row.attributes.artwork.url
          : null,
      })),
      nextOffset: listing.next === undefined ? null : offset + limit,
    };
  } catch {
    return null;
  }
}

/**
 * Whether ah ahh answers for its player, not just its server: the server is up within a
 * moment of a launch, but until the page inside has loaded a library call hangs for ah ahh's
 * own fifteen seconds. One attempt is the "is it already up" check; more is the bounded wait
 * for a launch.
 */
export async function waitForForkMusicPlayer(
  target: ForkMusicTarget,
  attempts: number,
  delayMs = 500,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const response = await call(target, "/v1/queue", { signal: AbortSignal.timeout(1500) });
      if (response?.ok === true) return true;
    } catch {
      // Not listening yet, or the page has not loaded to answer.
    }
  }
  return false;
}

/**
 * Streams ah ahh's player state to `onState`, never synchronously, until the returned function
 * is called. The ten-second heartbeat that only carries the position as far as the song played
 * is dropped (the panel advances it itself); a seek comes through. A stream that ends on its
 * own reports `closed` or `error` once and is not retried here.
 */
export function followForkMusic(
  target: ForkMusicTarget,
  onState: (state: ForkMusicState) => void,
  now: () => number = Date.now,
): () => void {
  const abort = new AbortController();
  const run = async (): Promise<"closed" | "error"> => {
    const response = await call(target, "/v1/events", { signal: abort.signal });
    if (response === null) return "closed";
    if (!response.ok || response.body === null) return "error";
    const decoder = new TextDecoder();
    let buffered = "";
    let lastSent: {
      readonly rest: string;
      readonly positionMs: number;
      readonly at: number;
    } | null = null;
    for await (const chunk of response.body) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const player = Option.getOrNull(decodePlayer(JSON.parse(line.slice("data: ".length))));
        if (player === null) return "error";
        const { positionMs, ...others } = player;
        const rest = JSON.stringify(others);
        const at = now();
        if (lastSent !== null && lastSent.rest === rest) {
          const expected = lastSent.positionMs + (player.playing ? at - lastSent.at : 0);
          if (Math.abs(expected - positionMs) < POSITION_TOLERANCE_MS) continue;
        }
        lastSent = { rest, positionMs, at };
        onState({ status: "ready", ...player });
      }
    }
    return "closed";
  };
  void run()
    .catch(() => "closed" as const)
    .then((status) => {
      if (!abort.signal.aborted) onState({ status });
    });
  return () => abort.abort();
}

/** The state last streamed, read back with a playing song's position moved on to now. */
export function latestForkMusicState(now: () => number = Date.now) {
  let state: ForkMusicState | null = null;
  let at = 0;
  return {
    set(next: ForkMusicState | null): void {
      state = next;
      at = now();
    },
    get(): ForkMusicState | null {
      if (state?.status !== "ready" || !state.playing) return state;
      return { ...state, positionMs: Math.min(state.positionMs + now() - at, state.durationMs) };
    },
  };
}
