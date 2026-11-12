/**
 * What the music panel shows. A module store, because the right panel remounts on every
 * thread switch and what is playing should not blink out with it. It follows ah ahh only
 * while a panel is mounted. See .fork/customizations.yaml#fork-music-panel.
 */
import {
  type MusicCommand,
  type MusicRequest,
  type MusicState,
  readMusicBridge,
} from "./musicBridge";

export interface MusicTrack {
  readonly id: string;
  readonly name: string;
  readonly artist: string;
}

export interface MusicPlaylist {
  readonly id: string;
  readonly name: string;
}

export interface MusicQueueEntry {
  /** Its place in ah ahh's queue, which is what jumping to it takes. */
  readonly index: number;
  readonly title: string;
  readonly artist: string;
}

/** The whole library's songs, listed among the playlists. No real playlist has an empty id. */
export const MUSIC_ALL_SONGS: MusicPlaylist = { id: "", name: "Songs" };

/** Apple's page size, and the most songs ah ahh takes in one play command. */
const PAGE_SIZE = 100;
const TRACK_LIMIT = 500;

export interface MusicSnapshot {
  /** Null until ah ahh first answers. */
  readonly state: MusicState | null;
  /** ah ahh's queue after the playing song. */
  readonly upNext: ReadonlyArray<MusicQueueEntry> | null;
  readonly playlists: ReadonlyArray<MusicPlaylist> | null;
  /** The playlist opened in the panel; its tracks are null until the first page arrives. */
  /** ah ahh is being started; `openFailed` once that did not work (it is not installed). */
  readonly opening: boolean;
  readonly openFailed: boolean;
  readonly browsing: {
    readonly playlist: MusicPlaylist;
    readonly tracks: ReadonlyArray<MusicTrack> | null;
    readonly truncated: boolean;
  } | null;
}

let snapshot: MusicSnapshot = {
  state: null,
  upNext: null,
  playlists: null,
  opening: false,
  openFailed: false,
  browsing: null,
};
const listeners = new Set<() => void>();
let stopListening: (() => void) | null = null;

function update(patch: Partial<MusicSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Never rejects; without a bridge, or with a failed call, the answer is null. */
async function ask(request: MusicRequest): Promise<unknown> {
  try {
    return (await readMusicBridge()?.request(request)) ?? null;
  } catch {
    return null;
  }
}

function readState(value: unknown): MusicState | null {
  if (!isObject(value)) return null;
  if (value.status === "closed" || value.status === "error") return { status: value.status };
  if (value.status !== "ready") return null;
  return {
    status: "ready",
    playing: value.playing === true,
    title: typeof value.title === "string" ? value.title : null,
    artist: text(value.artist),
    album: text(value.album),
    artwork: typeof value.artwork === "string" ? value.artwork : null,
    volume: typeof value.volume === "number" ? value.volume : 1,
    queueRevision: typeof value.queueRevision === "number" ? value.queueRevision : 0,
  };
}

type ListingRow = { readonly id: string; readonly attributes: Record<string, unknown> };

/**
 * Reads an Apple Music library listing through ah ahh, a page at a time. `onPage` gets the
 * rows so far and whether Apple has more, and returns false to stop. A failed page stops it.
 */
async function readListing(
  path: string,
  onPage: (rows: ReadonlyArray<ListingRow>, more: boolean) => boolean,
): Promise<void> {
  const rows: ListingRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await ask({ type: "music", path, params: { limit: PAGE_SIZE, offset } });
    if (!isObject(response) || !("data" in response)) return;
    // ah ahh answers null data for Apple's 404, which is how Apple lists an empty playlist.
    const body = isObject(response.data) ? response.data : {};
    for (const row of Array.isArray(body.data) ? body.data : []) {
      if (isObject(row) && typeof row.id === "string" && isObject(row.attributes)) {
        rows.push({ id: row.id, attributes: row.attributes });
      }
    }
    const more = typeof body.next === "string";
    if (!onPage(rows, more) || !more) return;
  }
}

let playlistsLoading = false;

async function loadPlaylists(): Promise<void> {
  if (playlistsLoading) return;
  playlistsLoading = true;
  await readListing("/v1/me/library/playlists", (rows, more) => {
    if (more && rows.length < TRACK_LIMIT) return true;
    update({
      playlists: [
        MUSIC_ALL_SONGS,
        ...rows.map((row) => ({ id: row.id, name: text(row.attributes.name) })),
      ],
    });
    return false;
  });
  playlistsLoading = false;
}

let upNextRequest = 0;

async function loadUpNext(): Promise<void> {
  const request = ++upNextRequest;
  const response = await ask({ type: "queue" });
  if (request !== upNextRequest) return;
  const queue = isObject(response) && isObject(response.queue) ? response.queue : null;
  if (queue === null || !Array.isArray(queue.items)) return;
  // The first entry is the song playing.
  const upNext = queue.items
    .slice(1)
    .flatMap((entry) =>
      isObject(entry) && typeof entry.index === "number"
        ? [{ index: entry.index, title: text(entry.title), artist: text(entry.artist) }]
        : [],
    );
  update({ upNext });
}

/** The volume this panel last asked for, shown until ah ahh reports it back. */
let sentVolume: number | null = null;
let pendingVolume: number | null = null;
let volumeInFlight = false;

const queueKey = (state: MusicState | null) =>
  state?.status === "ready" ? `${state.queueRevision}|${state.title}|${state.artist}` : null;

function applyState(incoming: MusicState): void {
  let state = incoming;
  if (state.status !== "ready") sentVolume = null;
  else if (sentVolume !== null) {
    // ah ahh reports the volume a moment behind a drag; an older value would snap the slider back.
    if (!volumeInFlight && Math.abs(state.volume - sentVolume) < 0.005) sentVolume = null;
    else state = { ...state, volume: sentVolume };
  }
  const queueChanged = queueKey(state) !== queueKey(snapshot.state);
  const launch = state.status === "closed" && launchWhenClosed;
  launchWhenClosed = false;
  update(state.status === "ready" ? { state, openFailed: false } : { state });
  if (launch) void openMusic();
  if (state.status !== "ready") return;
  if (queueChanged) void loadUpNext();
  // Also the retry for a load that failed, on whatever ah ahh reports next.
  if (snapshot.playlists === null) void loadPlaylists();
}

/** Set by the music button: the click that opens the panel is the one that may start ah ahh. */
let launchWhenClosed = false;

/** Lets the next "ah ahh is closed" answer start it. Remounts on a thread switch never do. */
export function launchMusicWhenClosed(): void {
  // A panel still mounted (reopened mid exit animation) is already following, and would keep this armed.
  launchWhenClosed = listeners.size === 0 && readMusicBridge()?.canOpen === true;
}

/** Starts ah ahh where the desktop can, then follows it. Elsewhere this is only the retry. */
export async function openMusic(): Promise<void> {
  if (snapshot.opening) return;
  if (readMusicBridge()?.canOpen === true) {
    update({ opening: true, openFailed: false });
    const answer = await ask({ type: "open" });
    update({ opening: false, openFailed: !isObject(answer) || answer.ok !== true });
  }
  // The panel may have closed during the launch; following then would hold the stream open for no one.
  if (listeners.size > 0) await followMusic();
}

/** Starts following ah ahh, which answers with its state. Also the retry after it was closed. */
async function followMusic(): Promise<void> {
  const state = readState(await ask({ type: "follow" }));
  if (state !== null) applyState(state);
}

/** ah ahh reports what a command did through its state, so there is nothing to await. */
export function sendMusic(command: MusicCommand): void {
  void ask({ type: "command", ...command });
}

/** Shows the new volume at once and sends only the latest value while a drag is producing them. */
export function setMusicVolume(volume: number): void {
  if (snapshot.state?.status !== "ready") return;
  sentVolume = volume;
  update({ state: { ...snapshot.state, volume } });
  pendingVolume = volume;
  if (volumeInFlight) return;
  volumeInFlight = true;
  void (async () => {
    while (pendingVolume !== null) {
      const next = pendingVolume;
      pendingVolume = null;
      const answer = await ask({ type: "command", action: "volume", value: next });
      // Not taken: stop holding the slider on a value ah ahh will never report.
      if (!isObject(answer) || answer.ok !== true) sentVolume = null;
    }
    volumeInFlight = false;
  })();
}

/** Opens a playlist in the panel and loads its tracks; null goes back to the list. */
export async function browseMusicPlaylist(playlist: MusicPlaylist | null): Promise<void> {
  update({ browsing: playlist === null ? null : { playlist, tracks: null, truncated: false } });
  if (playlist === null) return;
  const path =
    playlist === MUSIC_ALL_SONGS
      ? "/v1/me/library/songs"
      : `/v1/me/library/playlists/${playlist.id}/tracks`;
  await readListing(path, (rows, more) => {
    if (snapshot.browsing?.playlist !== playlist) return false;
    const full = rows.length >= TRACK_LIMIT;
    const tracks = rows.slice(0, TRACK_LIMIT).map((row) => ({
      id: row.id,
      name: text(row.attributes.name),
      artist: text(row.attributes.artistName),
    }));
    update({ browsing: { playlist, tracks, truncated: more && full } });
    return !full;
  });
  // Nothing came back at all: ah ahh went away, and its state says so.
  if (snapshot.browsing?.playlist === playlist && snapshot.browsing.tracks === null) {
    update({ browsing: null });
  }
}

/** Plays the open playlist from the song at `index`. */
export function playBrowsedTrack(index: number): void {
  const { browsing } = snapshot;
  if (browsing === null || browsing.tracks === null) return;
  if (browsing.playlist === MUSIC_ALL_SONGS) {
    const ids = browsing.tracks.map((track) => track.id);
    sendMusic({ action: "playSongs", value: { ids, startWith: index } });
    return;
  }
  sendMusic({
    action: "playItem",
    value: { type: "library-playlists", id: browsing.playlist.id, startWith: index },
  });
}

export function subscribeMusic(listener: () => void): () => void {
  listeners.add(listener);
  const bridge = readMusicBridge();
  if (listeners.size === 1 && bridge !== null) {
    const stopState = bridge.onState((raw) => {
      const state = readState(raw);
      if (state !== null) applyState(state);
    });
    // ah ahh opened while this window sat in the background: coming back is the cue to look again.
    const onFocus = () => {
      if (snapshot.state?.status !== "ready") void followMusic();
    };
    const page = typeof window === "undefined" ? null : window;
    page?.addEventListener("focus", onFocus);
    stopListening = () => {
      stopState();
      page?.removeEventListener("focus", onFocus);
      void ask({ type: "unfollow" });
    };
    void followMusic();
    // The last answer keeps showing meanwhile; what changed while the panel was shut shows up here.
    if (snapshot.state?.status === "ready") {
      void loadPlaylists();
      void loadUpNext();
    }
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopListening?.();
    stopListening = null;
  };
}

export const getMusicSnapshot = (): MusicSnapshot => snapshot;
