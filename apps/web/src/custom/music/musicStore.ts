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

export type MusicTab = "songs" | "playlists" | "artists" | "upNext";
type BrowseTab = "playlists" | "artists";

/** Something the panel opens: a playlist or album lists songs, an artist lists albums. */
export interface MusicSource {
  readonly name: string;
  /** Its listing in the Apple Music library API, which also tells one source from another. */
  readonly path: string;
  readonly lists: "songs" | "albums";
  /** An Apple `{w}x{h}` cover template. */
  readonly artwork: string | null;
}

/** A library listing; rows are null until the first page arrives. */
export interface MusicListing {
  readonly rows: ReadonlyArray<MusicRow> | null;
  /** It stopped at its cap with more to come. */
  readonly truncated: boolean;
}

export interface OpenedMusicSource extends MusicListing {
  readonly source: MusicSource;
}

const SONGS_PATH = "/v1/me/library/songs";
const PLAYLISTS_PATH = "/v1/me/library/playlists";
const ARTISTS_PATH = "/v1/me/library/artists";
/** The most songs ah ahh takes in one play command, and so the most a list shows. */
const TRACK_LIMIT = 500;
/** First-song cover reads in flight at once, for the playlists Apple gives no art. */
const COVER_READS = 4;

export interface MusicSnapshot {
  /** Null until ah ahh first answers. */
  readonly state: MusicState | null;
  /** When `state` arrived, which its position is as of. */
  readonly stateAt: number;
  /** The volume set here, shown in place of ah ahh's own until ah ahh reports it back. */
  readonly sentVolume: number | null;
  /** ah ahh's queue after the playing song. */
  readonly upNext: ReadonlyArray<MusicQueueEntry> | null;
  readonly tab: MusicTab;
  /** Each list is read the first time its tab shows; null until it is. */
  readonly songs: MusicListing | null;
  readonly playlists: ReadonlyArray<MusicSource> | null;
  readonly artists: ReadonlyArray<MusicSource> | null;
  /** What each browsing tab has open, innermost last: an artist, then one of its albums. */
  readonly opened: Readonly<Record<BrowseTab, ReadonlyArray<OpenedMusicSource>>>;
  /** ah ahh is being started; `openFailed` once that did not work (it is not installed). */
  readonly opening: boolean;
  readonly openFailed: boolean;
}

let snapshot: MusicSnapshot = {
  state: null,
  stateAt: 0,
  sentVolume: null,
  upNext: null,
  tab: "songs",
  songs: null,
  playlists: null,
  artists: null,
  opened: { playlists: [], artists: [] },
  opening: false,
  openFailed: false,
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

/**
 * Reads a listing up to `max` rows, reporting each page as it lands so a long list shows
 * from its first page. Null when not even one page came back.
 */
async function readListing(
  path: string,
  onPage: (listing: MusicListing) => boolean,
  max = TRACK_LIMIT,
): Promise<MusicListing | null> {
  let listing: MusicListing | null = null;
  for await (const page of libraryPages(path)) {
    const rows: ReadonlyArray<MusicRow> = [...(listing?.rows ?? []), ...page.rows].slice(0, max);
    const full = rows.length >= max;
    listing = { rows, truncated: full && page.nextOffset !== null };
    if (!onPage(listing) || full) break;
  }
  return listing;
}

const sourceOf = {
  playlist: (row: MusicRow): MusicSource => ({
    name: row.name,
    path: `${PLAYLISTS_PATH}/${row.id}/tracks`,
    lists: "songs",
    artwork: row.artwork,
  }),
  artist: (row: MusicRow): MusicSource => ({
    name: row.name,
    path: `${ARTISTS_PATH}/${row.id}/albums`,
    lists: "albums",
    artwork: null,
  }),
  album: (row: MusicRow): MusicSource => ({
    name: row.name,
    path: `/v1/me/library/albums/${row.id}/tracks`,
    lists: "songs",
    artwork: row.artwork,
  }),
};

const loading = new Set<"songs" | BrowseTab>();

/**
 * Playlists the user made have no art of their own, so they take their first song's, as
 * Apple's apps do. One single-row read each, a few at a time, and one update per batch.
 */
async function fillPlaylistCovers(playlists: ReadonlyArray<MusicSource>): Promise<void> {
  const bridge = readMusicBridge();
  const bare = playlists.filter((playlist) => playlist.artwork === null);
  if (bridge === null) return;
  for (let start = 0; start < bare.length; start += COVER_READS) {
    const batch = bare.slice(start, start + COVER_READS);
    const covers = await Promise.all(
      batch.map(async (playlist) => (await bridge.libraryPage(playlist.path, 0, 1))?.rows[0]),
    );
    const found = new Map(batch.map((playlist, index) => [playlist.path, covers[index]?.artwork]));
    // A newer listing replaced this one while the covers were read.
    if (snapshot.playlists === null || !snapshot.playlists.some((p) => found.has(p.path))) return;
    update({
      playlists: snapshot.playlists.map((playlist) => {
        const artwork = found.get(playlist.path);
        return artwork ? { ...playlist, artwork } : playlist;
      }),
    });
  }
}

/** Reads a tab's list. Nothing listed is a failed call: left as it was, to try again later. */
async function loadList(tab: MusicTab): Promise<void> {
  if (tab === "upNext" || loading.has(tab)) return;
  loading.add(tab);
  try {
    if (tab === "songs") {
      await readListing(SONGS_PATH, (songs) => {
        update({ songs });
        return true;
      });
      return;
    }
    // Names only, so a whole library's worth is cheap; songs stop at what one play takes.
    const listing = await readListing(
      tab === "playlists" ? PLAYLISTS_PATH : ARTISTS_PATH,
      () => true,
      Number.POSITIVE_INFINITY,
    );
    if (listing === null || listing.rows === null) return;
    if (tab === "artists") {
      update({ artists: listing.rows.map(sourceOf.artist) });
      return;
    }
    const playlists = listing.rows.map(sourceOf.playlist);
    update({ playlists });
    void fillPlaylistCovers(playlists);
  } finally {
    loading.delete(tab);
  }
}

/** Shows a tab, reading its list the first time. */
export function showMusicTab(tab: MusicTab): void {
  update({ tab });
  if (tab === "upNext") {
    if (upNextStale) void loadUpNext();
  } else if (snapshot[tab] === null) void loadList(tab);
}

/** Opens a playlist, artist or album inside the tab showing it, and reads what it lists. */
export async function openMusicSource(source: MusicSource): Promise<void> {
  const tab = snapshot.tab;
  if (tab !== "playlists" && tab !== "artists") return;
  const stack = snapshot.opened[tab];
  // Opened again while still reading: start it over rather than stacking a copy.
  const base = stack.at(-1)?.source.path === source.path ? stack.slice(0, -1) : stack;
  const entry: OpenedMusicSource = { source, rows: null, truncated: false };
  const setTop = (next: OpenedMusicSource | null) =>
    update({ opened: { ...snapshot.opened, [tab]: next === null ? base : [...base, next] } });
  setTop(entry);
  let current = entry;
  const listing = await readListing(source.path, (page) => {
    // Gone back, or opened something else, while this was reading.
    if (snapshot.opened[tab].at(-1) !== current) return false;
    current = { source, ...page };
    setTop(current);
    return true;
  });
  // Nothing came back at all: ah ahh went away, and its state says so.
  if (listing === null && snapshot.opened[tab].at(-1) === current) setTop(null);
}

/** Goes back one level in the tab showing. */
export function closeMusicSource(): void {
  const tab = snapshot.tab;
  if (tab !== "playlists" && tab !== "artists") return;
  update({ opened: { ...snapshot.opened, [tab]: snapshot.opened[tab].slice(0, -1) } });
}

/** The source an artist's album row opens. */
export const albumSource = sourceOf.album;

let upNextRequest = 0;
/** The queue changed since it was last read; it is read again only while Up Next shows. */
let upNextStale = true;

async function loadUpNext(): Promise<void> {
  const request = ++upNextRequest;
  upNextStale = false;
  const upNext = (await readMusicBridge()?.upNext()) ?? null;
  if (request !== upNextRequest) return;
  if (upNext === null) upNextStale = true;
  else update({ upNext });
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
  update(
    state.status === "ready"
      ? { state, stateAt: Date.now(), openFailed: false }
      : { state, stateAt: Date.now() },
  );
  settleVolume();
  if (state.status !== "ready") return;
  if (queueKey(state) !== queueKey(previous)) {
    upNextStale = true;
    if (snapshot.tab === "upNext") void loadUpNext();
  }
  // A restarted ah ahh may have a changed library; a failed listing is tried again here.
  const tab = snapshot.tab;
  if (tab !== "upNext" && (snapshot[tab] === null || previous?.status !== "ready")) {
    void loadList(tab);
  }
}

/** ah ahh reports what a command did through its state, so there is nothing to await. */
export function sendMusic(command: MusicCommand): void {
  void readMusicBridge()?.command(command);
}

/**
 * Plays the listed songs from the one at `index`. By id rather than by pointing ah ahh at
 * the playlist, so what plays is what the list shows even if the playlist changed since.
 */
export function playMusicRows(rows: ReadonlyArray<MusicRow>, index: number): void {
  sendMusic({ action: "playSongs", value: { ids: rows.map((row) => row.id), startWith: index } });
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
