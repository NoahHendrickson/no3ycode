import type { Meta, StoryObj } from "@storybook/react-vite";
import { Layers02Icon } from "@hugeicons/core-free-icons";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import type { CSSProperties } from "react";

import { ComposerWorkspaceTriggerIcon } from "~/custom/ComposerWorkspaceFooter";
import { CornerRadiusIcon } from "~/custom/designMode/panel/CornerRadiusIcon";
import { LayerTypeIcon } from "~/custom/designMode/panel/LayerTypeIcon";
import { PaddingIcon } from "~/custom/designMode/panel/PaddingIcon";
import { ForkReturnGlyph } from "~/custom/ForkReturnGlyph";
import { HugeGlyph } from "~/custom/icons/lucide-hugeicons";
import {
  ForkProviderMark,
  ModelPickerProviderGlyph,
} from "~/custom/icons/ModelPickerProviderGlyph";
import { ShieldOffFilledIcon } from "~/custom/icons/ShieldOffFilledIcon";
import { WorktreeIcon } from "~/custom/icons/WorktreeIcon";
import { SidebarStageDitherArt } from "~/custom/SidebarStageDitherArt";
import { SidebarV2SectionCaret } from "~/custom/SidebarV2SectionLabel";
import { SidebarV2ProjectFolderMark } from "~/custom/SidebarV2ThreadCardMeta";
import { StopSquareIcon } from "~/custom/StopSquareIcon";
import { deriveProviderInstanceEntries } from "~/providerInstances";

import { Row, Stack } from "../Specimen.tsx";

const CLAUDE = ProviderDriverKind.make("claudeAgent");
const CODEX = ProviderDriverKind.make("codex");
const CURSOR = ProviderDriverKind.make("cursor");

const provider = (driver: ProviderDriverKind, displayName: string): ServerProvider => ({
  instanceId: ProviderInstanceId.make(driver),
  driver,
  displayName,
  enabled: true,
  installed: true,
  version: null,
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-11-24T09:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
});

const ENTRIES = deriveProviderInstanceEntries([
  provider(CLAUDE, "Claude"),
  provider(CODEX, "Codex"),
  provider(CURSOR, "Cursor"),
]);

const LAYER_TAGS = ["div", "p", "button", "a", "img", "input", "ul", "svg", "section"] as const;

/** Every glyph the fork draws for itself, at the size its call site draws it. */
function Glyphs() {
  return (
    <Stack gap={3}>
      <Row label="Return">
        <ForkReturnGlyph />
      </Row>
      <Row label="Stop">
        <StopSquareIcon />
        <StopSquareIcon size={16} />
      </Row>
      <Row label="Full access">
        <ShieldOffFilledIcon className="size-3" />
        <ShieldOffFilledIcon className="size-4" />
      </Row>
      <Row label="Worktree">
        <WorktreeIcon className="size-3" />
        <WorktreeIcon className="size-4" />
      </Row>
      <Row label="Workspace">
        <ComposerWorkspaceTriggerIcon effectiveEnvMode="local" activeWorktreePath={null} />
        <ComposerWorkspaceTriggerIcon effectiveEnvMode="worktree" activeWorktreePath={null} />
        <ComposerWorkspaceTriggerIcon
          effectiveEnvMode="local"
          activeWorktreePath={null}
          forceNewWorktree
        />
      </Row>
      <Row label="Project folder">
        <SidebarV2ProjectFolderMark className="size-3 text-muted-foreground" />
        <SidebarV2ProjectFolderMark className="size-4 text-muted-foreground" />
      </Row>
      <Row label="Section caret">
        <SidebarV2SectionCaret collapsed={false} className="size-3.5 text-muted-foreground" />
        <SidebarV2SectionCaret collapsed className="size-3.5 text-muted-foreground" />
      </Row>
      <Row label="Hugeicon">
        <HugeGlyph data={Layers02Icon} filled={false} className="size-4" />
        <HugeGlyph data={Layers02Icon} filled className="size-4" />
      </Row>
    </Stack>
  );
}

const meta = {
  title: "Fork/Glyphs",
  component: Glyphs,
  tags: ["autodocs"],
} satisfies Meta<typeof Glyphs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The marks no icon set has: drawn in Figma, in `currentColor`, so each takes its host's ink. */
export const Gallery: Story = {};

/** The fork's own provider marks (Claude's, Codex's cloud) and the model picker's glyph, which
    falls back to upstream's icon for every other provider. */
export const ProviderMarks: Story = {
  name: "Provider marks",
  render: () => (
    <Stack gap={3}>
      <Row label="Fork mark">
        {[CLAUDE, CODEX].map((driver) => (
          <span
            key={driver}
            className="flex"
            style={{ "--fork-mark-size": "1.25rem" } as CSSProperties}
          >
            <ForkProviderMark driver={driver} />
          </span>
        ))}
      </Row>
      <Row label="Picker glyph">
        {ENTRIES.map((entry) => (
          <ModelPickerProviderGlyph key={entry.instanceId} entry={entry} showBadge={false} />
        ))}
      </Row>
      <Row label="With badge">
        {ENTRIES.map((entry) => (
          <ModelPickerProviderGlyph key={entry.instanceId} entry={entry} showBadge />
        ))}
      </Row>
    </Stack>
  ),
};

/** The design panel's own glyphs: per-corner radius, paired padding, and a layer row's kind. */
export const DesignPanel: Story = {
  name: "Design panel",
  render: () => (
    <div data-fork-design-panel="" className="text-muted-foreground">
      <Stack gap={3}>
        <Row label="Corner radius">
          {(["tl", "tr", "bl", "br"] as const).map((corner) => (
            <span key={corner} className="inline-flex size-4 *:size-full">
              <CornerRadiusIcon corner={corner} />
            </span>
          ))}
        </Row>
        <Row label="Padding">
          <span className="inline-flex size-4 *:size-full">
            <PaddingIcon axis="inline" />
          </span>
          <span className="inline-flex size-4 *:size-full">
            <PaddingIcon axis="block" />
          </span>
        </Row>
        <Row label="Layer kind">
          {LAYER_TAGS.map((tag) => (
            <LayerTypeIcon key={tag} tag={tag} className="size-4" />
          ))}
        </Row>
      </Stack>
    </div>
  ),
};

/** The dev channel's artwork, across a header and in a small button's corner. */
export const StageDither: Story = {
  name: "Stage dither",
  render: () => (
    <Row>
      <span className="block h-12 w-64 overflow-hidden rounded-lg">
        <SidebarStageDitherArt />
      </span>
      <span className="block size-7 overflow-hidden rounded-md">
        <SidebarStageDitherArt compact />
      </span>
    </Row>
  ),
};
