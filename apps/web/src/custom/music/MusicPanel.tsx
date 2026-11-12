/**
 * The right panel's Music tab: a remote for ah ahh on this computer. What is playing, the
 * transport, the volume, the library's playlists and ah ahh's queue. ah ahh does the
 * playing; nothing here streams audio. See .fork/customizations.yaml#fork-music-panel.
 */
import {
  ChevronLeftIcon,
  ListMusicIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
} from "lucide-react";
import { memo, useState, useSyncExternalStore } from "react";

import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { cn } from "~/lib/utils";

import { SegmentedTab, SegmentedTabs } from "../SegmentedTabs";
import { type MusicState, readMusicBridge } from "./musicBridge";
import {
  browseMusicPlaylist,
  getMusicSnapshot,
  type MusicPlaylist,
  type MusicQueueEntry,
  type MusicSnapshot,
  type MusicTrack,
  openMusic,
  playBrowsedTrack,
  sendMusic,
  setMusicVolume,
  subscribeMusic,
} from "./musicStore";

type ReadyState = Extract<MusicState, { status: "ready" }>;
type MusicTab = "playlists" | "upNext";

const ROW_CLASS =
  "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

const UNAVAILABLE: Record<
  Exclude<MusicState["status"], "ready">,
  { readonly title: string; readonly description: string }
> = {
  closed: {
    title: "ah ahh isn't open",
    description: "Your music shows up here once it's running.",
  },
  error: {
    title: "Couldn't reach ah ahh",
    description: "It's running, but it didn't answer.",
  },
};

function MusicUnavailable(props: {
  status: Exclude<MusicState["status"], "ready">;
  opening: boolean;
  openFailed: boolean;
}) {
  const canOpen = readMusicBridge()?.canOpen === true;
  const copy = props.opening
    ? { title: "Opening ah ahh", description: "Your music shows up here in a moment." }
    : props.openFailed
      ? {
          title: "Couldn't open ah ahh",
          description: "Check that it's installed on this computer.",
        }
      : UNAVAILABLE[props.status];
  return (
    <Empty size="compact">
      <EmptyMedia variant="icon">
        <MusicIcon />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{copy.title}</EmptyTitle>
        <EmptyDescription>{copy.description}</EmptyDescription>
      </EmptyHeader>
      {props.opening ? null : (
        <Button size="sm" variant="outline" onClick={() => void openMusic()}>
          {canOpen && props.status === "closed" ? "Open ah ahh" : "Try again"}
        </Button>
      )}
    </Empty>
  );
}

function NowPlaying({ state }: { state: ReadyState }) {
  return (
    <div className="flex shrink-0 flex-col gap-2 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {state.artwork === null ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <MusicIcon className="size-4" />
          </span>
        ) : (
          <img alt="" className="size-10 shrink-0 rounded-md object-cover" src={state.artwork} />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{state.title ?? "Nothing playing"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {state.title === null
              ? "Pick a playlist to start."
              : [state.artist, state.album].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <Button
          aria-label="Previous"
          size="icon-xs"
          variant="ghost"
          onClick={() => sendMusic({ action: "previous" })}
        >
          <SkipBackIcon />
        </Button>
        <Button
          aria-label={state.playing ? "Pause" : "Play"}
          size="icon-xs"
          variant="ghost"
          onClick={() => sendMusic({ action: "toggle" })}
        >
          {state.playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          aria-label="Next"
          size="icon-xs"
          variant="ghost"
          onClick={() => sendMusic({ action: "next" })}
        >
          <SkipForwardIcon />
        </Button>
        <Volume2Icon className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
        <input
          aria-label="Volume"
          className="h-1 min-w-0 flex-1 cursor-pointer accent-foreground"
          max={100}
          min={0}
          onChange={(event) => setMusicVolume(Number(event.currentTarget.value) / 100)}
          type="range"
          value={Math.round(state.volume * 100)}
        />
      </div>
    </div>
  );
}

function SongRow(props: { title: string; artist: string; playing: boolean; onPlay: () => void }) {
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
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{props.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{props.artist}</span>
      </span>
      {props.playing ? <Volume2Icon className="size-3.5 shrink-0 text-muted-foreground" /> : null}
    </button>
  );
}

/** Memoized on its own so a volume drag does not re-render a library's worth of rows. */
const TrackList = memo(function TrackList(props: {
  tracks: ReadonlyArray<MusicTrack>;
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
        key={`${track.id}:${repeat}`}
        onPlay={() => playBrowsedTrack(index)}
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

function Playlists({
  playlists,
  browsing,
  state,
}: Pick<MusicSnapshot, "playlists" | "browsing"> & { state: ReadyState }) {
  if (browsing === null) {
    return playlists?.map((playlist) => (
      <button
        className={ROW_CLASS}
        key={playlist.id}
        onClick={() => void browseMusicPlaylist(playlist)}
        type="button"
      >
        <ListMusicIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">{playlist.name}</span>
      </button>
    ));
  }
  const { tracks, truncated } = browsing;
  return (
    <>
      {tracks === null ? null : tracks.length === 0 ? (
        <Note>Nothing in here yet.</Note>
      ) : (
        <TrackList playingArtist={state.artist} playingTitle={state.title} tracks={tracks} />
      )}
      {truncated ? <Note>Showing the first 500 songs. Open ah ahh for the rest.</Note> : null}
    </>
  );
}

/** Sits above the scrolling list, so the way back stays in reach down a long playlist. */
function PlaylistHeader({ playlist }: { playlist: MusicPlaylist }) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1 px-1.5 pb-1">
      <Button
        aria-label="Back to playlists"
        size="icon-xs"
        variant="ghost"
        onClick={() => void browseMusicPlaylist(null)}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{playlist.name}</span>
      <Button
        aria-label={`Play ${playlist.name}`}
        size="icon-xs"
        variant="ghost"
        onClick={() => playBrowsedTrack(0)}
      >
        <PlayIcon />
      </Button>
    </div>
  );
}

export function MusicPanel() {
  const { state, upNext, playlists, browsing, opening, openFailed } = useSyncExternalStore(
    subscribeMusic,
    getMusicSnapshot,
  );
  const [tab, setTab] = useState<MusicTab>("playlists");
  // ah ahh answers within a frame or two; a spinner would only flash.
  if (state === null) return null;
  if (state.status !== "ready") {
    return <MusicUnavailable openFailed={openFailed} opening={opening} status={state.status} />;
  }
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" data-fork-music-panel="">
      <NowPlaying state={state} />
      <div className="flex shrink-0 border-t px-3 py-2">
        <SegmentedTabs
          aria-label="Music lists"
          onValueChange={(value) => {
            const next = value[0];
            if (next === "playlists" || next === "upNext") setTab(next);
          }}
          value={[tab]}
        >
          <SegmentedTab value="playlists">Playlists</SegmentedTab>
          <SegmentedTab value="upNext">Up Next</SegmentedTab>
        </SegmentedTabs>
      </div>
      {tab === "playlists" && browsing !== null ? (
        <PlaylistHeader playlist={browsing.playlist} />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {tab === "playlists" ? (
          <Playlists browsing={browsing} playlists={playlists} state={state} />
        ) : (
          <UpNext upNext={upNext} />
        )}
      </div>
    </div>
  );
}
