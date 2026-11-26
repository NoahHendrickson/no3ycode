import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";

import { ComposerNextStepPillView } from "~/custom/ComposerNextStepPill";

import { Row, Stack } from "../Specimen.tsx";
import { StoryComposer } from "../StoryComposer.tsx";

type PickedComposerNextStep = ComponentProps<typeof ComposerNextStepPillView>["step"];

const RULED: Record<Exclude<PickedComposerNextStep["kind"], "learned">, PickedComposerNextStep> = {
  "open-pr": { kind: "open-pr", label: "Open a PR", prompt: "open a PR", habit: null },
  babysit: { kind: "babysit", label: "Babysit the PR", prompt: "babysit the PR", habit: null },
  merge: { kind: "merge", label: "Merge the PR", prompt: "merge the PR", habit: null },
  release: { kind: "release", label: "Cut a release", prompt: "cut a release", habit: null },
};

const LEARNED: PickedComposerNextStep = {
  kind: "learned",
  label: "Run the sol loop",
  prompt: "run the sol loop",
  habit: { previousKey: "open a pr", nextKey: "run the sol loop", text: "run the sol loop" },
};

/** The pill where the app mounts it: a status chip above the composer at rest. */
function Composer(props: { readonly step: PickedComposerNextStep }) {
  return (
    <div className="w-[736px] max-w-full">
      <StoryComposer
        prompt="Ask anything"
        statusChips={
          <ComposerNextStepPillView step={props.step} onSend={() => {}} onForget={() => {}} />
        }
      />
    </div>
  );
}

const meta = {
  title: "Fork/Composer next step",
  component: Composer,
  tags: ["autodocs"],
  parameters: { surface: "composer" },
  args: { step: RULED["open-pr"] },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The thread's next step once its run settles and the composer is empty; a click sends it.
    The pill picks the step from the thread's PRs and git status, so the story hands it in. */
export const Playground: Story = {};

/** The owner's usual chain, each step with its own icon. */
export const RuledSteps: Story = {
  name: "Ruled steps",
  parameters: { controls: { disable: true } },
  render: () => (
    <Stack gap={4}>
      {Object.entries(RULED).map(([kind, step]) => (
        <Row key={kind} label={kind}>
          <Composer step={step} />
        </Row>
      ))}
    </Stack>
  ),
};

/** A step learned from what the owner usually sends next, with a stop button that forgets it. */
export const Learned: Story = {
  args: { step: LEARNED },
};
