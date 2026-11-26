import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  ForkDictationCancelButton,
  ForkDictationGhostMic,
  ForkDictationNotices,
  ForkDictationPreview,
} from "~/custom/voice/ForkDictationControl";
import type { ForkDictation } from "~/custom/voice/forkDictation";

import { Stack } from "../Specimen.tsx";
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

/** The composer's right-hand actions for one dictation phase: the mic, which a live session swaps
    for the white capsule (its level and the check), and the X that cancels it. */
function Controls({ phase }: { phase: Phase }) {
  const value = dictation(phase);
  return (
    <div data-chat-composer-actions="right" className="flex items-center gap-1">
      <ForkDictationGhostMic dictation={value} disabled={false} />
      {value.blocksSubmission ? <ForkDictationCancelButton dictation={value} /> : null}
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

/** Dictation in the composer: the mic beside send; a live session grows a white capsule with its
    level and a check where the mic was, and an X to cancel. */
export const Playground: Story = {};

/** Every phase: at rest, preparing, recording, and transcribing (the check spins). */
export const Phases: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={3}>
      {PHASES.map((phase) => (
        <div key={phase}>
          <span className="font-mono text-[11px] text-muted-foreground">{phase}</span>
          <InComposer phase={phase} />
        </div>
      ))}
    </Stack>
  ),
};

/** A live session's cancel X, trailing the capsule, and leading it beside stop. */
export const CancelButton: Story = {
  name: "Cancel button",
  parameters: { controls: { disable: true } },
  render: () => (
    <div data-chat-composer-actions="right" className="flex items-center gap-1">
      <ForkDictationCancelButton dictation={dictation("recording")} />
    </div>
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
