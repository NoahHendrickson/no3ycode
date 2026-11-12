import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDownIcon, FolderIcon, GitBranchIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { ComposerShell } from "~/custom/ComposerShell";

// DraftProjectPill's chip look; the composer context row and data-fork-chip-menu are what
// connect the menu to its chip (H3 in .fork/notes/INLET-STYLE-RULES.md).
const CHIP =
  "min-w-0 max-w-72 font-normal text-muted-foreground/70 text-xs! hover:text-foreground/80 active:scale-100";

function ChipMenu({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <Menu defaultOpen={defaultOpen}>
      <MenuTrigger
        render={<Button size="xs" variant="ghost" className={CHIP} data-composer-context-control />}
      >
        <FolderIcon className="size-3 shrink-0" />
        no3ycode
        <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
      </MenuTrigger>
      <MenuPopup align="start" side="top" data-fork-glass-rim data-fork-chip-menu="">
        <MenuItem>no3ycode</MenuItem>
        <MenuItem>portfolio</MenuItem>
        <MenuItem>shaders-lab</MenuItem>
      </MenuPopup>
    </Menu>
  );
}

function ComposerWithChipMenu({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl pt-56">
      <ComposerShell
        approvalPending={false}
        collapsedMobile={false}
        mobilePendingActionsVisible={false}
        context={
          <div className="flex items-center gap-1">
            <ChipMenu defaultOpen={defaultOpen} />
            <Button size="xs" variant="ghost" className={CHIP} data-composer-context-control>
              <GitBranchIcon className="size-3 shrink-0" />
              t3/fork-storybook
            </Button>
          </div>
        }
        modeControls={null}
        modelControls={null}
        readoutControls={null}
      >
        <div className="min-h-20 p-3 text-sm text-muted-foreground">Ask anything…</div>
      </ComposerShell>
    </div>
  );
}

const meta = {
  title: "Patterns/Composer context strip",
  component: ComposerWithChipMenu,
  args: { defaultOpen: true },
  parameters: { surface: "composer" },
} satisfies Meta<typeof ComposerWithChipMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = { args: { defaultOpen: false } };
