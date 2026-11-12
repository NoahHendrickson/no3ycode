/**
 * What the music panel shows. A module store, because the right panel remounts on every
 * thread switch and what is playing should not blink out with it. It follows ah ahh only
 * while a panel is mounted. See .fork/customizations.yaml#fork-music-panel.
 */
import {
  type MusicCommand,
  type MusicQueueEntry,
  type MusicRow,
  type MusicState,
  readMusicBridge,
} from "./musicBridge";

/** Something whose songs the panel can list: a playlist, or the whole library. */
export interface MusicSource {
  readonly name: string;
  /** Its listing in the Apple Music library API, which also tells one source from another. */
  readonly path: string;
}

const PLAYLISTS_PATH = "/v1/me/library/playlists";
const ALL_SONGS: MusicSource = { name: "Songs", path: "/v1/me/library/songs" };
/** The most songs ah ahh takes in one play command. */
const TRACK_LIMIT = 500;

export interface MusicSnapshot {
  /** Null until ah ahh first answers. */
  readonly state: MusicState | null;
  /** The volume set here, shown in place of ah ahh's own until ah ahh reports it back. */
  readonly sentVolume: number | null;
  /** ah ahh's queue after the playing song. */
  readonly upNext: ReadonlyArray<MusicQueueEntry> | null;
  /** The library's songs, then its playlists. */
  readonly sources: ReadonlyArray<MusicSource> | null;
  /** ah ahh is being started; `openFailed` once that did not work (it is not installed). */
  readonly opening: boolean;
  readonly openFailed: boolean;
  /** The source opened in the panel; its tracks are null until the first page arrives. */
  readonly browsing: {
    readonly source: MusicSource;
    readonly tracks: ReadonlyArray<MusicRow> | null;
    readonly truncated: boolean;
  } | null;
}

let snapshot: MusicSnapshot = {
  state: null,
  sentVolume: null,
  upNext: null,
  sources: null,
  opening: false,
  openFailed: false,
  browsing: null,
};
const listeners = new Set<() => void>();

function update(patch: Partial<MusicSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

/** The pages of a library listing, in order. A failed page ends it early. */
async function* libraryPages(path: string) {
  const bridge = readMusicBridge();
  if (bridge === null) return;
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await bridge.libraryPage(path, offset);
    if (page === null) return;
    yield page;
    offset = page.nextOffset;
  }
}

let sourcesLoading = false;

async function loadSources(): Promise<void> {
  if (sourcesLoading) return;
  sourcesLoading = true;
  const playlists: MusicSource[] = [];
  let listed = false;
  for await (const page of libraryPages(PLAYLISTS_PATH)) {
    listed = true;
    for (const row of page.rows) {
      playlists.push({ name: row.name, path: `${PLAYLISTS_PATH}/${row.id}/tracks` });
    }
  }
  sourcesLoading = false;
  // Nothing listed is a failed call: left as it was, so ah ahh's next state tries again.
  if (listed) update({ sources: [ALL_SONGS, ...playlists] });
}

let upNextRequest = 0;

async function loadUpNext(): Promise<void> {
  const request = ++upNextRequest;
  const upNext = (await readMusicBridge()?.upNext()) ?? null;
  if (request === upNextRequest && upNext !== null) update({ upNext });
}

/** The latest volume not yet handed to a command, and whether one is on its way. */
let pendingVolume: number | null = null;
let sendingVolume = false;

/**
 * Stops holding the slider once ah ahh has the volume set here: it reports that value and
 * nothing newer waits to go. An older report, a beat behind a drag, leaves it held.
 */
function settleVolume(): void {
  const { state, sentVolume } = snapshot;
  if (sentVolume === null) return;
  const reported = state?.status === "ready" ? state.volume : null;
  if (reported === null || (pendingVolume === null && Math.abs(reported - sentVolume) < 0.005)) {
    update({ sentVolume: null });
  }
}

/** Shows the new volume at once and sends only the latest value while a drag is producing them. */
export function setMusicVolume(volume: number): void {
  const bridge = readMusicBridge();
  if (bridge === null || snapshot.state?.status !== "ready") return;
  update({ sentVolume: volume });
  pendingVolume = volume;
  if (sendingVolume) return;
  sendingVolume = true;
  void (async () => {
    let taken = true;
    while (pendingVolume !== null) {
      const next = pendingVolume;
      pendingVolume = null;
      taken = await bridge.command({ action: "volume", value: next });
    }
    sendingVolume = false;
    // A refused command is never reported back. A taken one may already have been.
    if (taken) settleVolume();
    else update({ sentVolume: null });
  })();
}

const queueKey = (state: MusicState | null) =>
  state?.status === "ready" ? `${state.queueRevision}|${state.title}|${state.artist}` : null;

function applyState(state: MusicState): void {
  const previous = snapshot.state;
  update(state.status === "ready" ? { state, openFailed: false } : { state });
  settleVolume();
  if (state.status !== "ready") return;
  if (queueKey(state) !== queueKey(previous)) void loadUpNext();
  // A restarted ah ahh may have a changed library; a failed listing is tried again here.
  if (snapshot.sources === null || previous?.status !== "ready") void loadSources();
}

/** ah ahh reports what a command did through its state, so there is nothing to await. */
export function sendMusic(command: MusicCommand): void {
  void readMusicBridge()?.command(command);
}

let browseRequest = 0;

/** Opens a source in the panel and lists its songs; null goes back to the sources. */
export async function browseMusicSource(source: MusicSource | null): Promise<void> {
  const request = ++browseRequest;
  update({ browsing: source === null ? null : { source, tracks: null, truncated: false } });
  if (source === null) return;
  let tracks: ReadonlyArray<MusicRow> | null = null;
  for await (const page of libraryPages(source.path)) {
    if (request !== browseRequest) return;
    tracks = [...(tracks ?? []), ...page.rows].slice(0, TRACK_LIMIT);
    const full = tracks.length >= TRACK_LIMIT;
    update({ browsing: { source, tracks, truncated: full && page.nextOffset !== null } });
    if (full) break;
  }
  // Nothing came back at all: ah ahh went away, and its state says so.
  if (request === browseRequest && tracks === null) update({ browsing: null });
}

/**
 * Plays the listed songs from the one at `index`. By id rather than by pointing ah ahh at
 * the playlist, so what plays is what the list shows even if the playlist changed since.
 */
export function playBrowsedTrack(index: number): void {
  const tracks = snapshot.browsing?.tracks;
  if (!tracks) return;
  sendMusic({
    action: "playSongs",
    value: { ids: tracks.map((track) => track.id), startWith: index },
  });
}

/** Ends the current follow; set only while a panel is mounted. */
let unfollow: (() => void) | null = null;

function refollow(): void {
  unfollow?.();
  unfollow = readMusicBridge()?.follow(applyState) ?? null;
}

/** Follows ah ahh again after it was closed or did not answer. */
export function retryMusic(): void {
  if (unfollow !== null) refollow();
}

/**
 * Makes sure ah ahh is up, starting it where the desktop can. Called by the click that
 * opens the panel and by the panel's Open button, never by a mount. The desktop restarts
 * the ended stream itself once ah ahh answers.
 */
export async function openMusic(): Promise<void> {
  const bridge = readMusicBridge();
  if (bridge === null || !bridge.canOpen || snapshot.opening) return;
  update({ opening: true, openFailed: false });
  const opened = await bridge.open();
  update({ opening: false, openFailed: !opened });
}

// ah ahh opened by hand while this window sat in the background: coming back is the cue to look again.
function onFocus(): void {
  if (!snapshot.opening && snapshot.state !== null && snapshot.state.status !== "ready") {
    retryMusic();
  }
}

export function subscribeMusic(listener: () => void): () => void {
  const page = typeof window === "undefined" ? null : window;
  listeners.add(listener);
  if (listeners.size === 1) {
    refollow();
    page?.addEventListener("focus", onFocus);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    unfollow?.();
    unfollow = null;
    page?.removeEventListener("focus", onFocus);
  };
}

export const getMusicSnapshot = (): MusicSnapshot => snapshot;
