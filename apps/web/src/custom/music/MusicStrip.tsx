/**
 * The music strip floating above the sidebar footer: a remote for ah ahh on this computer. Folded,
 * it is the transport and the volume; expanded, it adds what is playing and the library's songs,
 * playlists and artists, and ah ahh's queue. ah ahh does the playing; nothing here streams audio.
 * See .fork/customizations.yaml#fork-music-panel.
 */
import {
  ChevronLeftIcon,
  ListMusicIcon,
  Maximize2Icon,
  Minimize2Icon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  Repeat1Icon,
  RepeatIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  UserRoundIcon,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { type CSSProperties, memo, useEffect, useRef, useSyncExternalStore } from "react";

import { Button } from "~/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { SegmentedTab, SegmentedTabs } from "../SegmentedTabs";
import {
  type MusicQueueEntry,
  type MusicRepeat,
  type MusicRow,
  type MusicState,
  readMusicBridge,
  sizedArtwork,
} from "./musicBridge";
import {
  closeMusicSource,
  getMusicSnapshot,
  type ListKind,
  type MusicListing,
  type MusicTab,
  openMusic,
  openMusicRow,
  playMusicRows,
  retryMusic,
  sendMusic,
  setMusicVolume,
  showMusicTab,
  subscribeMusic,
} from "./musicStore";
import { setMusicStripMode, useMusicStripMode } from "./musicStripMode";

type ReadyState = Extract<MusicState, { status: "ready" }>;

const ROW_CLASS =
  "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

function MusicUnavailable(props: {
  status: Exclude<MusicState["status"], "ready">;
  opening: boolean;
  openFailed: boolean;
}) {
  // Only a closed ah ahh can be started. One that answered badly is already running.
  const canOpen = props.status === "closed" && readMusicBridge()?.canOpen === true;
  const copy = props.opening
    ? { title: "Opening ah ahh", description: "Your music shows up here in a moment." }
    : props.status === "error"
      ? { title: "Couldn't reach ah ahh", description: "It's running, but it didn't answer." }
      : canOpen && props.openFailed
        ? {
            title: "Couldn't open ah ahh",
            description: "Check that it's installed on this computer.",
          }
        : {
            title: "ah ahh isn't open",
            description: "Your music shows up here once it's running.",
          };
  return (
    <div className="flex min-w-0 items-center gap-2 p-1.5">
      <Artwork src={null} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{copy.title}</div>
        <div className="truncate text-xs text-muted-foreground">{copy.description}</div>
      </div>
      {props.opening ? null : canOpen ? (
        <Button size="xs" variant="outline" onClick={() => void openMusic()}>
          Open
        </Button>
      ) : (
        <Button size="xs" variant="outline" onClick={retryMusic}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** A thin track with the played part filled; `--fill` is how far, as a percentage. */
const SLIDER_CLASS =
  "h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [background:linear-gradient(var(--muted-foreground),var(--muted-foreground))_0_0/var(--fill)_100%_no-repeat,var(--border)] outline-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground focus-visible:[&::-webkit-slider-thumb]:size-4 focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-background focus-visible:[&::-webkit-slider-thumb]:ring-inset";

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** Paints a position onto the bar and its elapsed time; the thumb is the caller's to move. */
function paintPosition(
  bar: HTMLInputElement | null,
  label: HTMLSpanElement | null,
  ms: number,
  durationMs: number,
) {
  const clamped = Math.min(Math.max(ms, 0), durationMs);
  if (label) label.textContent = clock(clamped);
  if (!bar) return;
  bar.style.setProperty("--fill", `${durationMs > 0 ? (clamped / durationMs) * 100 : 0}%`);
  bar.setAttribute("aria-valuetext", `${clock(clamped)} of ${clock(durationMs)}`);
}

/**
 * Where the song is, ticking once a second while it plays. ah ahh only says where it was
 * when something changed, so the bar runs on from there; the tick writes to the DOM rather
 * than re-rendering the panel. Dragging seeks on release.
 */
function PlaybackBar(props: {
  positionMs: number;
  positionAt: number;
  durationMs: number;
  playing: boolean;
}) {
  const { positionMs, positionAt, durationMs, playing } = props;
  const input = useRef<HTMLInputElement>(null);
  const elapsed = useRef<HTMLSpanElement>(null);
  /** Where the song was at `at`; a seek moves it ahead of ah ahh's next report. */
  const base = useRef({ positionMs, at: positionAt });
  const scrubbing = useRef(false);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a once-a-second clock while the song plays, painted straight to the DOM
  useEffect(() => {
    base.current = { positionMs, at: positionAt };
    const tick = () => {
      if (scrubbing.current) return;
      const { positionMs: from, at } = base.current;
      const ms = from + (playing ? Date.now() - at : 0);
      paintPosition(input.current, elapsed.current, ms, durationMs);
      if (input.current) input.current.value = String(Math.min(Math.max(ms, 0), durationMs) / 1000);
    };
    tick();
    if (!playing) return;
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [positionMs, positionAt, durationMs, playing]);

  const commit = () => {
    if (!scrubbing.current || !input.current) return;
    scrubbing.current = false;
    const seconds = Number(input.current.value);
    base.current = { positionMs: seconds * 1000, at: Date.now() };
    sendMusic({ action: "seek", value: seconds });
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-8 shrink-0 text-xs text-muted-foreground tabular-nums" ref={elapsed}>
        {clock(positionMs)}
      </span>
      <input
        aria-label="Playback position"
        className={SLIDER_CLASS}
        defaultValue={positionMs / 1000}
        max={durationMs / 1000}
        min={0}
        onBlur={commit}
        onChange={(event) => {
          scrubbing.current = true;
          paintPosition(
            event.currentTarget,
            elapsed.current,
            Number(event.currentTarget.value) * 1000,
            durationMs,
          );
        }}
        onKeyUp={commit}
        onPointerUp={commit}
        ref={input}
        step={1}
        type="range"
      />
      <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {clock(durationMs)}
      </span>
    </div>
  );
}

const nextRepeat = { 0: 2, 2: 1, 1: 0 } as const satisfies Record<MusicRepeat, MusicRepeat>;
const repeatLabel = { 0: "Repeat off", 2: "Repeat all", 1: "Repeat one" } as const;

/** The song's cover, or a note when there is none; the strip's leading mark. */
function Artwork({ src }: { src: string | null }) {
  return src === null ? (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <MusicIcon className="size-4" />
    </span>
  ) : (
    <img
      alt=""
      className="size-8 shrink-0 rounded-md bg-muted object-cover"
      draggable={false}
      src={src}
    />
  );
}

/** Expanded only: what is playing, where it is, shuffle and repeat. */
function NowPlaying({ state }: { state: ReadyState }) {
  return (
    <div className="flex shrink-0 flex-col gap-2 p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{state.title ?? "Nothing playing"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {state.title === null
              ? "Pick a playlist to start."
              : [state.artist, state.album].filter(Boolean).join(" · ")}
          </div>
        </div>
        <Toggle
          aria-label={state.shuffle ? "Shuffle on" : "Shuffle off"}
          onPressedChange={(shuffle) => sendMusic({ action: "shuffle", value: shuffle })}
          pressed={state.shuffle}
          size="xs"
          variant="ghost"
        >
          <ShuffleIcon className="size-3.5" />
        </Toggle>
        <Toggle
          aria-label={repeatLabel[state.repeat]}
          onPressedChange={() => sendMusic({ action: "repeat", value: nextRepeat[state.repeat] })}
          pressed={state.repeat !== 0}
          size="xs"
          variant="ghost"
        >
          {state.repeat === 1 ? (
            <Repeat1Icon className="size-3.5" />
          ) : (
            <RepeatIcon className="size-3.5" />
          )}
        </Toggle>
      </div>
      {state.title !== null && state.durationMs > 0 ? (
        <PlaybackBar
          durationMs={state.durationMs}
          playing={state.playing}
          positionAt={state.positionAt}
          positionMs={state.positionMs}
        />
      ) : null}
    </div>
  );
}

function VolumeButton({ volume }: { volume: number }) {
  const percent = Math.round(volume * 100);
  return (
    <Popover>
      <PopoverTrigger
        render={<Button aria-label={`Volume ${percent}%`} size="icon-sm" variant="ghost" />}
      >
        {percent === 0 ? <VolumeOff /> : <Volume2 />}
      </PopoverTrigger>
      <PopoverPopup align="end" padding="compact" side="top">
        <div className="flex w-40 items-center gap-2">
          <input
            aria-label="Volume"
            className={SLIDER_CLASS}
            max={100}
            min={0}
            onChange={(event) => setMusicVolume(Number(event.currentTarget.value) / 100)}
            style={{ "--fill": `${percent}%` } as CSSProperties}
            type="range"
            value={percent}
          />
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {percent}
          </span>
        </div>
      </PopoverPopup>
    </Popover>
  );
}

/** The strip itself, folded or not: cover, previous, play or pause, next, volume, expand. */
function Transport(props: { state: ReadyState; volume: number; expanded: boolean }) {
  const { state, volume, expanded } = props;
  return (
    // Equal side columns, so the transport centres on the card rather than between the cover and the
    // two buttons on the right. A sidebar too narrow for that (it goes down to 208px) drops the cover.
    <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-1 p-1.5 @max-[14.5rem]/strip:grid-cols-[auto_1fr]">
      <div className="@max-[14.5rem]/strip:hidden">
        <Artwork src={state.artwork} />
      </div>
      <div className="flex items-center gap-1">
        <Button
          aria-label="Previous"
          size="icon-sm"
          variant="ghost"
          onClick={() => sendMusic({ action: "previous" })}
        >
          <SkipBackIcon />
        </Button>
        <Button
          aria-label={state.playing ? "Pause" : "Play"}
          size="icon-sm"
          variant="ghost"
          onClick={() => sendMusic({ action: "toggle" })}
        >
          {state.playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          aria-label="Next"
          size="icon-sm"
          variant="ghost"
          onClick={() => sendMusic({ action: "next" })}
        >
          <SkipForwardIcon />
        </Button>
      </div>
      <div className="flex items-center justify-end gap-1">
        <VolumeButton volume={volume} />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={expanded ? "Collapse music" : "Expand music"}
                size="icon-sm"
                variant="ghost"
                onClick={() => setMusicStripMode(expanded ? "open" : "expanded")}
              />
            }
          >
            {expanded ? <Minimize2Icon /> : <Maximize2Icon />}
          </TooltipTrigger>
          <TooltipPopup side="top">{expanded ? "Collapse" : "Playlists and queue"}</TooltipPopup>
        </Tooltip>
      </div>
    </div>
  );
}

/** Lazy, so only covers scrolled into view are fetched and decoded. */
function Cover({ src }: { src: string | null }) {
  return src === null ? (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
      <MusicIcon className="size-3.5" />
    </span>
  ) : (
    <img
      alt=""
      className="size-8 shrink-0 rounded-sm bg-muted object-cover"
      decoding="async"
      draggable={false}
      height={32}
      loading="lazy"
      src={sizedArtwork(src, 96)}
      width={32}
    />
  );
}

function SongRow(props: {
  title: string;
  artist: string;
  artwork: string | null;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      aria-current={props.playing ? "true" : undefined}
      // Rows off screen skip layout and paint; a library's list runs to hundreds.
      className={cn(
        ROW_CLASS,
        "[contain-intrinsic-size:auto_2.75rem] [content-visibility:auto]",
        props.playing && "bg-accent",
      )}
      onClick={props.onPlay}
      type="button"
    >
      <Cover src={props.artwork} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{props.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{props.artist}</span>
      </span>
      {props.playing ? <Volume2 className="size-3.5 shrink-0 text-muted-foreground" /> : null}
    </button>
  );
}

/** Memoized on its own so a volume drag does not re-render a library's worth of rows. */
const TrackList = memo(function TrackList(props: {
  tracks: ReadonlyArray<MusicRow>;
  playingTitle: string | null;
  playingArtist: string;
}) {
  // A playlist can hold the same song twice, so a key counts the repeats.
  const repeats = new Map<string, number>();
  return props.tracks.map((track, index) => {
    const repeat = repeats.get(track.id) ?? 0;
    repeats.set(track.id, repeat + 1);
    return (
      <SongRow
        artist={track.artist}
        artwork={track.artwork}
        key={`${track.id}:${repeat}`}
        onPlay={() => playMusicRows(props.tracks, index)}
        // ah ahh's state names the song but not its library id.
        playing={track.name === props.playingTitle && track.artist === props.playingArtist}
        title={track.name}
      />
    );
  });
});

const UpNext = memo(function UpNext({ upNext }: { upNext: ReadonlyArray<MusicQueueEntry> | null }) {
  if (upNext?.length === 0) return <Note>Nothing queued after this song.</Note>;
  return upNext?.map((entry) => (
    <SongRow
      artist={entry.artist}
      artwork={entry.artwork}
      key={entry.index}
      onPlay={() => sendMusic({ action: "jumpTo", value: entry.index })}
      playing={false}
      title={entry.title}
    />
  ));
});

function Note({ children }: { children: string }) {
  return <p className="px-2 py-1.5 text-xs text-balance text-muted-foreground">{children}</p>;
}

function Songs({ listing, state }: { listing: MusicListing; state: ReadyState }) {
  if (listing.rows === null) return null;
  return (
    <>
      {listing.rows.length === 0 ? (
        <Note>Nothing in here yet.</Note>
      ) : (
        <TrackList playingArtist={state.artist} playingTitle={state.title} tracks={listing.rows} />
      )}
      {listing.truncated ? (
        <Note>Showing the first 500 songs. Open ah ahh for the rest.</Note>
      ) : null}
    </>
  );
}

/** Playlists and an artist's albums, as covers. Few enough that every tile renders. */
const CoverGrid = memo(function CoverGrid(props: {
  rows: ReadonlyArray<MusicRow>;
  kind: Extract<ListKind, "playlists" | "albums">;
}) {
  const { rows, kind } = props;
  if (rows.length === 0) return <Note>Nothing in here yet.</Note>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-1 py-1">
      {rows.map((row) => (
        <button
          className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-md p-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          key={row.id}
          onClick={() => void openMusicRow(row, kind)}
          type="button"
        >
          {row.artwork === null ? (
            <span className="flex aspect-square w-full items-center justify-center rounded-sm bg-muted text-muted-foreground">
              <ListMusicIcon className="size-6" />
            </span>
          ) : (
            <img
              alt=""
              className="aspect-square w-full rounded-sm bg-muted object-cover"
              decoding="async"
              draggable={false}
              loading="lazy"
              src={sizedArtwork(row.artwork, 300)}
            />
          )}
          <span className="block w-full truncate text-xs font-medium">{row.name}</span>
        </button>
      ))}
    </div>
  );
});

const ArtistList = memo(function ArtistList({ rows }: { rows: ReadonlyArray<MusicRow> }) {
  if (rows.length === 0) return <Note>Nothing in here yet.</Note>;
  return rows.map((artist) => (
    <button
      className={cn(ROW_CLASS, "[contain-intrinsic-size:auto_2rem] [content-visibility:auto]")}
      key={artist.id}
      onClick={() => void openMusicRow(artist, "artists")}
      type="button"
    >
      <UserRoundIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{artist.name}</span>
    </button>
  ));
});

/** A listing as its kind of rows reads: songs as a list, playlists and albums as covers. */
function Listing({ listing, state }: { listing: MusicListing; state: ReadyState }) {
  if (listing.rows === null) return null;
  switch (listing.source.lists) {
    case "songs":
      return <Songs listing={listing} state={state} />;
    case "artists":
      return <ArtistList rows={listing.rows} />;
    case "playlists":
    case "albums":
      return <CoverGrid kind={listing.source.lists} rows={listing.rows} />;
  }
}

/** Sits above the scrolling list, so the way back stays in reach down a long playlist. */
function SourceHeader({ opened }: { opened: MusicListing }) {
  const { source, rows } = opened;
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1 px-1.5 pb-1">
      <Button aria-label="Back" size="icon-xs" variant="ghost" onClick={closeMusicSource}>
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{source.name}</span>
      {source.lists === "songs" && rows !== null && rows.length > 0 ? (
        <Button
          aria-label={`Play ${source.name}`}
          size="icon-xs"
          variant="ghost"
          onClick={() => playMusicRows(rows, 0)}
        >
          <PlayIcon />
        </Button>
      ) : null}
    </div>
  );
}

const TABS: ReadonlyArray<{ readonly value: MusicTab; readonly label: string }> = [
  { value: "songs", label: "Songs" },
  { value: "playlists", label: "Playlists" },
  { value: "artists", label: "Artists" },
  { value: "upNext", label: "Up Next" },
];

/**
 * The card is a step off the sidebar toward its ink, and restates every ink its controls read (the
 * contrast ones too, which text utilities use) from the sidebar's own pair, so palettes whose
 * sidebar is the opposite of their panel ink it to match.
 */
const CARD_CLASS = cn(
  "[--fork-music-ink:var(--sidebar-foreground)]",
  "[--fork-music-muted:color-mix(in_srgb,var(--fork-music-ink)_65%,var(--sidebar))]",
  "[--fork-music-step:color-mix(in_srgb,var(--fork-music-ink)_14%,var(--sidebar))]",
  "[--foreground:var(--fork-music-ink)] [--contrast-foreground:var(--fork-music-ink)] [--accent-foreground:var(--fork-music-ink)]",
  "[--muted-foreground:var(--fork-music-muted)] [--contrast-muted-foreground:var(--fork-music-muted)]",
  "[--accent:var(--fork-music-step)] [--muted:var(--fork-music-step)] [--border:var(--fork-music-step)] [--contrast-border:var(--fork-music-step)]",
  "[--background:var(--sidebar)]",
  "@container/strip flex min-w-0 flex-col overflow-hidden rounded-xl bg-(--fork-music-card) text-foreground shadow-[0_12px_32px_-18px_rgb(0_0_0/45%)]",
  "transition-[opacity,translate] duration-150 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none",
);

/** The selected tab is the sidebar's own fill in its ink; the tabs' dark-mode white would vanish on a light sidebar. */
const TAB_CLASS =
  "min-w-0 flex-1 px-1 dark:data-pressed:bg-background dark:data-pressed:text-foreground";

/** Mounted only while the strip shows, so ah ahh is followed only then. */
function MusicStripCard({ expanded }: { expanded: boolean }) {
  const snapshot = useSyncExternalStore(subscribeMusic, getMusicSnapshot);
  const { state, sentVolume, upNext, tab, stacks, opening, openFailed } = snapshot;
  if (state === null || state.status !== "ready") {
    // ah ahh answers within a frame or two; a spinner would only flash.
    if (state === null && !opening) return null;
    return (
      <div className={CARD_CLASS} data-fork-music-strip="">
        <MusicUnavailable
          openFailed={openFailed}
          opening={opening}
          status={state === null ? "closed" : state.status}
        />
      </div>
    );
  }
  const volume = sentVolume ?? state.volume;
  if (!expanded) {
    return (
      <div className={CARD_CLASS} data-fork-music-strip="">
        <Transport expanded={false} state={state} volume={volume} />
      </div>
    );
  }
  const stack = tab === "upNext" ? null : stacks[tab];
  const top = stack?.at(-1) ?? null;
  return (
    <div className={CARD_CLASS} data-fork-music-strip="expanded">
      <NowPlaying state={state} />
      <div className="flex shrink-0 border-t px-2 py-2">
        <SegmentedTabs
          aria-label="Music lists"
          className="w-full"
          onValueChange={(value) => {
            const next = TABS.find((entry) => entry.value === value[0]);
            if (next) showMusicTab(next.value);
          }}
          value={[tab]}
        >
          {TABS.map((entry) => (
            <SegmentedTab className={TAB_CLASS} key={entry.value} value={entry.value}>
              {entry.label}
            </SegmentedTab>
          ))}
        </SegmentedTabs>
      </div>
      {stack !== null && top !== null && stack.length > 1 ? <SourceHeader opened={top} /> : null}
      {/* A fixed height, so switching lists never moves the strip's controls. */}
      <div className="h-[min(20rem,40vh)] min-h-0 overflow-y-auto px-1 pb-1">
        {top === null ? <UpNext upNext={upNext} /> : <Listing listing={top} state={state} />}
      </div>
      <div className="border-t">
        <Transport expanded state={state} volume={volume} />
      </div>
    </div>
  );
}

export function SidebarMusicStrip() {
  const mode = useMusicStripMode();
  if (mode === "closed" || readMusicBridge() === null) return null;
  return <MusicStripCard expanded={mode === "expanded"} />;
}
