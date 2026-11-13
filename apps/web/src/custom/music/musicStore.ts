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
export type LibraryTab = Exclude<MusicTab, "upNext">;

/** What a listing's rows are, and so what one of them opens. */
export type ListKind = "songs" | "playlists" | "artists" | "albums";

/** Something a library tab lists: its own root, or a playlist, artist or album opened from it. */
export interface MusicSource {
  readonly name: string;
  /** Its listing in the Apple Music library API, which also tells one source from another. */
  readonly path: string;
  readonly lists: ListKind;
}

/** A source and what it lists; rows are null until the first page arrives. */
export interface MusicListing {
  readonly source: MusicSource;
  readonly rows: ReadonlyArray<MusicRow> | null;
  /** It stopped at its cap with more to come. */
  readonly truncated: boolean;
}

/** A library tab's own listing first, then what was opened from it, innermost last. */
type MusicStack = readonly [MusicListing, ...MusicListing[]];

const PLAYLISTS_PATH = "/v1/me/library/playlists";
const ARTISTS_PATH = "/v1/me/library/artists";
const ROOTS: Readonly<Record<LibraryTab, MusicSource>> = {
  songs: { name: "Songs", path: "/v1/me/library/songs", lists: "songs" },
  playlists: { name: "Playlists", path: PLAYLISTS_PATH, lists: "playlists" },
  artists: { name: "Artists", path: ARTISTS_PATH, lists: "artists" },
};
/** What a row opens, by the kind of listing it sits in. Songs play instead. */
const OPENS: Readonly<Partial<Record<ListKind, (row: MusicRow) => MusicSource>>> = {
  playlists: (row) => ({
    name: row.name,
    path: `${PLAYLISTS_PATH}/${row.id}/tracks`,
    lists: "songs",
  }),
  artists: (row) => ({ name: row.name, path: `${ARTISTS_PATH}/${row.id}/albums`, lists: "albums" }),
  albums: (row) => ({
    name: row.name,
    path: `/v1/me/library/albums/${row.id}/tracks`,
    lists: "songs",
  }),
};
/** The most songs ah ahh takes in one play command, and so the most a list shows. */
const TRACK_LIMIT = 500;
/** First-song cover reads in flight at once, for the playlists Apple gives no art. */
const COVER_READS = 4;

const emptyStack = (tab: LibraryTab): MusicStack => [
  { source: ROOTS[tab], rows: null, truncated: false },
];

export interface MusicSnapshot {
  /** Null until ah ahh first answers. */
  readonly state: MusicState | null;
  /** The volume set here, shown in place of ah ahh's own until ah ahh reports it back. */
  readonly sentVolume: number | null;
  /** ah ahh's queue after the playing song. */
  readonly upNext: ReadonlyArray<MusicQueueEntry> | null;
  readonly tab: MusicTab;
  /** Each library tab's listings; a root is read the first time its tab shows. */
  readonly stacks: Readonly<Record<LibraryTab, MusicStack>>;
  /** ah ahh is being started; `openFailed` once that did not work (it is not installed). */
  readonly opening: boolean;
  readonly openFailed: boolean;
}

let snapshot: MusicSnapshot = {
  state: null,
  sentVolume: null,
  upNext: null,
  tab: "songs",
  stacks: {
    songs: emptyStack("songs"),
    playlists: emptyStack("playlists"),
    artists: emptyStack("artists"),
  },
  opening: false,
  openFailed: false,
};
const listeners = new Set<() => void>();

function update(patch: Partial<MusicSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

const setStack = (tab: LibraryTab, stack: MusicStack) =>
  update({ stacks: { ...snapshot.stacks, [tab]: stack } });

/** The stack with its `at`th listing replaced. */
function replaceAt(stack: MusicStack, at: number, listing: MusicListing): MusicStack {
  const [root, ...opened] = stack;
  return at === 0
    ? [listing, ...opened]
    : [root, ...opened.map((entry, index) => (index === at - 1 ? listing : entry))];
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

/** Each playlist's first-song cover once read (null: it has none), so a re-listing reads none again. */
const playlistCovers = new Map<string, string | null>();

const withCovers = (rows: ReadonlyArray<MusicRow>): ReadonlyArray<MusicRow> =>
  rows.map((row) => {
    const cover = row.artwork === null ? playlistCovers.get(row.id) : null;
    return cover ? { ...row, artwork: cover } : row;
  });

let fillingCovers = false;

/**
 * Playlists the user made have no art of their own, so they take their first song's, as
 * Apple's apps do. One single-row read each, a few at a time, one update per batch. Rows a
 * newer listing brings are picked up by the next batch; a failed read waits for the next fill.
 */
async function fillPlaylistCovers(): Promise<void> {
  const bridge = readMusicBridge();
  if (bridge === null || fillingCovers) return;
  fillingCovers = true;
  try {
    for (;;) {
      const bare = (snapshot.stacks.playlists[0].rows ?? []).filter(
        (row) => row.artwork === null && !playlistCovers.has(row.id),
      );
      const batch = bare.slice(0, COVER_READS);
      if (batch.length === 0) return;
      const firsts = await Promise.all(
        batch.map((row) => bridge.libraryPage(`${PLAYLISTS_PATH}/${row.id}/tracks`, 0, 1)),
      );
      batch.forEach((row, index) => {
        const first = firsts[index];
        if (first) playlistCovers.set(row.id, first.rows[0]?.artwork ?? null);
      });
      const [root, ...opened] = snapshot.stacks.playlists;
      if (root.rows !== null)
        setStack("playlists", [{ ...root, rows: withCovers(root.rows) }, ...opened]);
      if (firsts.includes(null)) return;
    }
  } finally {
    fillingCovers = false;
  }
}

/**
 * Reads a listing into its tab, page by page, so a long list shows from its first page. It
 * keeps reading while its source is anywhere in the stack, so opening an album does not stop
 * its artist's later pages. Songs stop at what one play takes; names and covers read in full.
 * Null when not even one page came back.
 */
async function readInto(tab: LibraryTab, source: MusicSource): Promise<MusicListing | null> {
  const max = source.lists === "songs" ? TRACK_LIMIT : Number.POSITIVE_INFINITY;
  let listing: MusicListing | null = null;
  let all: ReadonlyArray<MusicRow> = [];
  for await (const page of libraryPages(source.path)) {
    const at = snapshot.stacks[tab].findIndex((entry) => entry.source === source);
    // Gone back past it, or opened again, while this was reading.
    if (at < 0) return listing;
    all = [...all, ...page.rows].slice(0, max);
    const full = all.length >= max;
    listing = {
      source,
      rows: source.lists === "playlists" ? withCovers(all) : all,
      truncated: full && page.nextOffset !== null,
    };
    setStack(tab, replaceAt(snapshot.stacks[tab], at, listing));
    if (full) break;
  }
  if (source.lists === "playlists") void fillPlaylistCovers();
  return listing;
}

/** Roots being read, and roots a restarted ah ahh may have changed since they were. */
const readingRoots = new Set<LibraryTab>();
const staleRoots = new Set<LibraryTab>();

/** Reads a tab's own listing again. Nothing listed is a failed call: left as it was, to try again later. */
async function readRoot(tab: LibraryTab): Promise<void> {
  if (readingRoots.has(tab)) return;
  readingRoots.add(tab);
  staleRoots.delete(tab);
  try {
    await readInto(tab, ROOTS[tab]);
  } finally {
    readingRoots.delete(tab);
  }
}

const rootWanted = (tab: LibraryTab) =>
  snapshot.stacks[tab][0].rows === null || staleRoots.has(tab);

/** Shows a tab, reading its list the first time and after ah ahh restarted. */
export function showMusicTab(tab: MusicTab): void {
  update({ tab });
  if (tab === "upNext") {
    if (upNextStale) void loadUpNext();
  } else if (rootWanted(tab)) void readRoot(tab);
}

/** Opens a playlist, artist or album row (from a listing of `kind`) in the tab showing. */
export async function openMusicRow(row: MusicRow, kind: ListKind): Promise<void> {
  const tab = snapshot.tab;
  const source = OPENS[kind]?.(row);
  if (tab === "upNext" || source === undefined) return;
  const [root, ...opened] = snapshot.stacks[tab];
  // Opened again while still reading: start it over rather than stacking a copy.
  const below = opened.at(-1)?.source.path === source.path ? opened.slice(0, -1) : opened;
  setStack(tab, [root, ...below, { source, rows: null, truncated: false }]);
  const listing = await readInto(tab, source);
  // Nothing came back at all: ah ahh went away, and its state says so.
  if (listing === null) {
    const stack = snapshot.stacks[tab];
    const at = stack.findIndex((entry) => entry.source === source);
    if (at > 0) setStack(tab, [stack[0], ...stack.slice(1, at)]);
  }
}

/** Goes back one level in the tab showing. */
export function closeMusicSource(): void {
  const tab = snapshot.tab;
  if (tab === "upNext") return;
  const [root, ...opened] = snapshot.stacks[tab];
  setStack(tab, [root, ...opened.slice(0, -1)]);
}

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
  update(state.status === "ready" ? { state, openFailed: false } : { state });
  settleVolume();
  if (state.status !== "ready") return;
  if (queueKey(state) !== queueKey(previous)) {
    upNextStale = true;
    if (snapshot.tab === "upNext") void loadUpNext();
  }
  // A restarted ah ahh may have a changed library: every root is read again as its tab
  // next shows. A failed listing is tried again here too.
  if (previous?.status !== "ready") {
    for (const tab of Object.keys(ROOTS) as LibraryTab[]) staleRoots.add(tab);
  }
  const tab = snapshot.tab;
  if (tab !== "upNext" && rootWanted(tab)) void readRoot(tab);
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
