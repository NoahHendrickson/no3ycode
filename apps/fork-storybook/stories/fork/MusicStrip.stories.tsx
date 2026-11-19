import type { Meta, StoryObj } from "@storybook/react-vite";

import { MusicStripCardView } from "~/custom/music/MusicStrip";
import type { MusicRow } from "~/custom/music/musicBridge";
import type { MusicListing, MusicSnapshot, MusicSource } from "~/custom/music/musicStore";

const source = (name: string, lists: MusicSource["lists"]): MusicSource => ({
  name,
  path: `/v1/me/library/${lists}`,
  lists,
});
const listing = (src: MusicSource, rows: ReadonlyArray<MusicRow>): MusicListing => ({
  source: src,
  rows,
  truncated: false,
});
const row = (id: string, name: string, artist = ""): MusicRow => ({
  id,
  name,
  artist,
  artwork: null,
});

const SNAPSHOT: MusicSnapshot = {
  state: {
    status: "ready",
    playing: true,
    title: "Harvest Moon",
    artist: "Neil Young",
    album: "Harvest Moon",
    artwork: null,
    durationMs: 303_000,
    positionMs: 81_000,
    // Where the song was, as of the story loading.
    positionAt: Date.now(),
    volume: 0.6,
    shuffle: false,
    repeat: 0,
    queueRevision: 1,
  },
  sentVolume: null,
  upNext: [
    { index: 1, title: "Unknown Legend", artist: "Neil Young", artwork: null },
    { index: 2, title: "From Hank to Hendrix", artist: "Neil Young", artwork: null },
  ],
  tab: "upNext",
  stacks: {
    songs: [
      listing(source("Songs", "songs"), [
        row("s1", "Harvest Moon", "Neil Young"),
        row("s2", "Pink Moon", "Nick Drake"),
        row("s3", "Re: Stacks", "Bon Iver"),
      ]),
    ],
    playlists: [listing(source("Playlists", "playlists"), [row("p1", "Focus"), row("p2", "Late")])],
    artists: [
      listing(source("Artists", "artists"), [
        row("a1", "Bon Iver"),
        row("a2", "Neil Young"),
        row("a3", "Nick Drake"),
      ]),
    ],
  },
  opening: false,
  openFailed: false,
};

const meta = {
  title: "Fork/Music strip",
  component: MusicStripCardView,
  tags: ["autodocs"],
  parameters: { surface: "sidebar" },
  args: { snapshot: SNAPSHOT, expanded: true },
  // The strip's fill and inks are scoped to the sidebar footer it sits in.
  decorators: [
    (Story) => (
      <div data-slot="sidebar-footer" className="w-64">
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof MusicStripCardView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sidebar's ah ahh strip, open on Up next: now playing, the list tabs, the queue and the
    transport. A static specimen: its controls write to the app's music store, not these args, so
    each tab has its own story. */
export const Playground: Story = {};

/** Folded to the transport alone. */
export const Collapsed: Story = { args: { expanded: false } };

export const Songs: Story = { args: { snapshot: { ...SNAPSHOT, tab: "songs" } } };

export const Playlists: Story = { args: { snapshot: { ...SNAPSHOT, tab: "playlists" } } };

export const Artists: Story = { args: { snapshot: { ...SNAPSHOT, tab: "artists" } } };

/** ah ahh isn't open. */
export const Closed: Story = { args: { snapshot: { ...SNAPSHOT, state: { status: "closed" } } } };
