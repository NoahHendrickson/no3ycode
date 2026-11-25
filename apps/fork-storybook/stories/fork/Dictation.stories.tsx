import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  ForkDictationGhostMic,
  ForkDictationNotices,
  ForkDictationPreview,
  ForkDictationPrimaryButton,
} from "~/custom/voice/ForkDictationControl";
import type { ForkDictation } from "~/custom/voice/forkDictation";

import { Row, Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

type Phase = ForkDictation["state"]["phase"];

const noop = () => {};

const dictation = (phase: Phase, error: string | null = null): ForkDictation => ({
  isAvailable: true,
  state:
    phase === "error" && error !== null
      ? { phase, error, errorAction: "settings" }
      : { phase, error: null, errorAction: null },
  level: 0.3,
  error,
  errorAction: error === null ? null : "settings",
  blocksSubmission: phase !== "idle" && phase !== "error",
  freezesEditor: phase === "transcribing" || phase === "post-processing",
  start: noop,
  stop: noop,
  cancel: noop,
  settleWithoutControls: noop,
});

// ComposerPrimaryActions' send button class, which dictation wears in the send slot.
const SEND_BUTTON =
  "relative isolate flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-message-action text-message-action-foreground shadow-xs transition-all duration-150 enabled:cursor-pointer enabled:inset-shadow-control-highlight enabled:shadow-message-action/24 hover:scale-105 hover:bg-message-action-hover active:inset-shadow-control-pressed active:shadow-none disabled:pointer-events-none disabled:opacity-64 disabled:shadow-none disabled:hover:scale-100 sm:h-8 sm:w-8 [&_svg]:pointer-events-none";

/** The composer's controls for one dictation phase: the ghost mic (or the level timeline while
    live) and the send slot it takes over. */
function Controls({ phase }: { phase: Phase }) {
  const value = dictation(phase);
  return (
    <div className="flex items-center gap-2">
      <ForkDictationGhostMic dictation={value} disabled={false} />
      <ForkDictationPrimaryButton dictation={value} disabled={false} className={SEND_BUTTON} />
    </div>
  );
}

/** The controls in the composer, where the theme sheets that dress them apply. */
function InComposer({ phase }: { phase: Phase }) {
  return (
    <div className="w-[736px] max-w-full">
      <StoryComposer prompt="Ask anything" modeControls={<Controls phase={phase} />} />
    </div>
  );
}

const PHASES: ReadonlyArray<Phase> = ["idle", "preparing", "recording", "transcribing"];

const meta = {
  title: "Fork/Dictation",
  component: InComposer,
  tags: ["autodocs"],
  parameters: { surface: "composer", router: true },
  args: { phase: "recording" },
  argTypes: { phase: { control: "inline-radio", options: PHASES } },
} satisfies Meta<typeof InComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Dictation in the composer: the mic beside attach; a live session shows its level and turns
    send into the check, with an X to cancel. */
export const Playground: Story = {};

/** Every phase: at rest, preparing, recording, and transcribing (the check spins). */
export const Phases: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      {PHASES.map((phase) => (
        <Row key={phase} label={phase}>
          <InComposer phase={phase} />
        </Row>
      ))}
    </Stack>
  ),
};

/** The words heard so far, after the draft they will join; the grey tail is still settling. */
export const Preview: Story = {
  parameters: { controls: { disable: true } },
  decorators: [(Story) => <div className="w-[736px] max-w-full">{Story()}</div>],
  render: () => (
    <Stack gap={3}>
      <ForkDictationPreview
        preview={{ committed: "Move the usage ring ", tentative: "next to the model picker" }}
        promptEmpty
      />
      <ForkDictationPreview
        preview={{ committed: "and keep its tooltip", tentative: "" }}
        promptEmpty={false}
      />
    </Stack>
  ),
};

/** A failed session's message, above the send slot, with the way to fix it. */
export const Notice: Story = {
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => <div className="flex w-[736px] max-w-full justify-end pt-40">{Story()}</div>,
  ],
  render: () => (
    <ForkDictationNotices
      dictation={dictation("error", "Microphone access was denied. Allow it in System Settings.")}
    />
  ),
};
