import type { Meta, StoryObj } from "@storybook/react-vite";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import {
  ComposerCardIconButton,
  ComposerCardRemoveButton,
  ComposerCardTitle,
} from "~/custom/ComposerCardParts";
import { ComposerStashChip } from "~/custom/ComposerStashChip";
import { PencilIcon } from "~/custom/icons/lucide-hugeicons";

import { Row, Stack } from "../Specimen.tsx";

const noop = () => {};

/** The parts the queue and stash cards share: a header label with its count, and row actions. */
function Parts() {
  return (
    <Stack>
      <Row label="title">
        <ComposerBanner.Row>
          <ComposerCardTitle count={3}>Queued</ComposerCardTitle>
        </ComposerBanner.Row>
        <ComposerBanner.Row>
          <ComposerCardTitle count={12}>Stash</ComposerCardTitle>
        </ComposerBanner.Row>
      </Row>
      <Row label="row actions">
        <ComposerCardIconButton aria-label="Edit">
          <PencilIcon />
        </ComposerCardIconButton>
        <ComposerCardRemoveButton aria-label="Remove" />
        <ComposerCardRemoveButton aria-label="Remove" disabled />
      </Row>
      <Row label="stash chip">
        <ComposerStashChip count={2} pulseKey={0} onOpen={noop} />
        <ComposerStashChip count={14} pulseKey={0} onOpen={noop} />
      </Row>
    </Stack>
  );
}

const meta = {
  title: "Fork/Composer card parts",
  component: Parts,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Parts>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The queue card's and stash card's header, row actions, and the stash's collapsed chip. */
export const Variants: Story = {};
