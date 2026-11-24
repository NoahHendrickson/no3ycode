import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import {
  ArrowUpRightIcon,
  CopyIcon,
  EllipsisIcon,
  GitBranchIcon,
  HammerIcon,
  LaptopIcon,
  LayersIcon,
  LinkIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  ScaleIcon,
  ScrollTextIcon,
  ServerIcon,
  Trash2Icon,
} from "lucide-react";

import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { Button } from "~/components/ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemDetail,
  MenuItemLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSearchInput,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "~/components/ui/menu";

import { POPUP_ANCHOR } from "../Specimen.tsx";

const ITEM_VARIANTS = ["default", "destructive", "ghost"] as const;
const CHECKBOX_VARIANTS = ["default", "icon", "switch"] as const;
const DENSITIES = ["default", "touch"] as const;
const WIDTHS = ["default", "content"] as const;
const SIDES = ["top", "bottom", "left", "right", "inline-start", "inline-end"] as const;
const ALIGNS = ["start", "center", "end"] as const;

// Fork rule: menu dividers run edge to edge, so each cancels the popup's 4px scroll padding.
const FULL_WIDTH_SEPARATOR = "-mx-1";

const columns = (count: number): CSSProperties => ({
  ...POPUP_ANCHOR,
  display: "grid",
  gridTemplateColumns: `repeat(${count}, 240px)`,
  alignItems: "start",
  justifyItems: "start",
});

function MoreTrigger({ label = "More actions" }: { label?: string }) {
  return (
    <MenuTrigger render={<Button variant="outline" size="icon-sm" aria-label={label} />}>
      <EllipsisIcon />
    </MenuTrigger>
  );
}

function LabelledTrigger({ children }: { children: string }) {
  return <MenuTrigger render={<Button variant="outline" size="sm" />}>{children}</MenuTrigger>;
}

const meta = {
  title: "Components/Menu",
  component: Menu,
  tags: ["autodocs"],
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

type PlaygroundArgs = {
  variant: (typeof ITEM_VARIANTS)[number];
  density: (typeof DENSITIES)[number];
  width: (typeof WIDTHS)[number];
  side: (typeof SIDES)[number];
  align: (typeof ALIGNS)[number];
  disabled: boolean;
};

export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    variant: "default",
    density: "default",
    width: "default",
    side: "bottom",
    align: "center",
    disabled: false,
  },
  argTypes: {
    variant: { control: "select", options: ITEM_VARIANTS },
    density: { control: "select", options: DENSITIES },
    width: { control: "select", options: WIDTHS },
    side: { control: "select", options: SIDES },
    align: { control: "select", options: ALIGNS },
    disabled: { control: "boolean" },
  },
  render: ({ variant, density, width, side, align, disabled }) => (
    <Menu defaultOpen modal={false}>
      <LabelledTrigger>Thread actions</LabelledTrigger>
      <MenuPopup width={width} side={side} align={align}>
        <MenuItem variant={variant} density={density} disabled={disabled}>
          <PencilIcon />
          <MenuItemLabel>Rename thread</MenuItemLabel>
        </MenuItem>
        <MenuItem variant={variant} density={density} disabled={disabled}>
          <PinIcon />
          <MenuItemLabel>Pin thread</MenuItemLabel>
        </MenuItem>
        <MenuItem variant={variant} density={density} disabled={disabled}>
          <CopyIcon />
          <MenuItemLabel>Copy thread link</MenuItemLabel>
        </MenuItem>
      </MenuPopup>
    </Menu>
  ),
};

export const Variants: Story = {
  render: () => (
    <div style={columns(3)}>
      <Menu defaultOpen modal={false}>
        <LabelledTrigger>Item variants</LabelledTrigger>
        <MenuPopup align="start">
          {ITEM_VARIANTS.map((variant) => (
            <MenuItem key={variant} variant={variant}>
              <LayersIcon />
              {variant}
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
      <Menu defaultOpen modal={false}>
        <LabelledTrigger>Checkbox variants</LabelledTrigger>
        <MenuPopup align="start">
          {CHECKBOX_VARIANTS.map((variant) => (
            <MenuCheckboxItem key={variant} variant={variant} defaultChecked>
              {variant}
            </MenuCheckboxItem>
          ))}
          {CHECKBOX_VARIANTS.map((variant) => (
            <MenuCheckboxItem key={`${variant}-off`} variant={variant}>
              {variant} (off)
            </MenuCheckboxItem>
          ))}
        </MenuPopup>
      </Menu>
      <Menu defaultOpen modal={false}>
        <LabelledTrigger>Radio items</LabelledTrigger>
        <MenuPopup align="start">
          <MenuRadioGroup defaultValue="squash">
            <MenuRadioItem value="merge">Create a merge commit</MenuRadioItem>
            <MenuRadioItem value="squash">Squash and merge</MenuRadioItem>
            <MenuRadioItem value="rebase">Rebase and merge</MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuRadioGroup defaultValue="local">
            <MenuRadioItem value="local">
              <span className="flex items-center justify-between gap-4">
                Local
                <MenuRadioItemIndicator />
              </span>
            </MenuRadioItem>
            <MenuRadioItem value="worktree">
              <span className="flex items-center justify-between gap-4">
                New worktree
                <MenuRadioItemIndicator />
              </span>
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={columns(4)}>
      {DENSITIES.map((density) => (
        <Menu key={density} defaultOpen modal={false}>
          <LabelledTrigger>{`density: ${density}`}</LabelledTrigger>
          <MenuPopup align="start">
            <MenuItem density={density}>
              <ArrowUpRightIcon />
              <MenuItemLabel>Open on GitHub</MenuItemLabel>
            </MenuItem>
            <MenuItem density={density}>
              <LinkIcon />
              <MenuItemLabel>Copy link</MenuItemLabel>
            </MenuItem>
            <MenuSub>
              <MenuSubTrigger density={density}>
                <GitBranchIcon />
                Open in
              </MenuSubTrigger>
              <MenuSubPopup>
                <MenuItem>Cursor</MenuItem>
                <MenuItem>VS Code</MenuItem>
              </MenuSubPopup>
            </MenuSub>
          </MenuPopup>
        </Menu>
      ))}
      {WIDTHS.map((width) => (
        <Menu key={width} defaultOpen modal={false}>
          <LabelledTrigger>{`width: ${width}`}</LabelledTrigger>
          <MenuPopup align="start" width={width}>
            <MenuItem>Copy</MenuItem>
            <MenuItem>Paste</MenuItem>
          </MenuPopup>
        </Menu>
      ))}
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div style={POPUP_ANCHOR}>
      <Menu defaultOpen modal={false}>
        <LabelledTrigger>Item states</LabelledTrigger>
        <MenuPopup align="start" className="w-64">
          <MenuGroup>
            <MenuGroupLabel>default</MenuGroupLabel>
            <MenuItem>
              <LinkIcon />
              Resting
            </MenuItem>
            <MenuItem data-highlighted="">
              <LinkIcon />
              Highlighted
            </MenuItem>
            <MenuItem disabled>
              <LinkIcon />
              Disabled
            </MenuItem>
          </MenuGroup>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuGroup>
            <MenuGroupLabel>destructive</MenuGroupLabel>
            <MenuItem variant="destructive">
              <Trash2Icon />
              Resting
            </MenuItem>
            <MenuItem variant="destructive" data-highlighted="">
              <Trash2Icon />
              Highlighted
            </MenuItem>
            <MenuItem variant="destructive" disabled>
              <Trash2Icon />
              Disabled
            </MenuItem>
          </MenuGroup>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuGroup>
            <MenuGroupLabel>checkbox / radio</MenuGroupLabel>
            <MenuCheckboxItem defaultChecked>Checked</MenuCheckboxItem>
            <MenuCheckboxItem>Unchecked</MenuCheckboxItem>
            <MenuCheckboxItem defaultChecked disabled>
              Checked, disabled
            </MenuCheckboxItem>
            <MenuRadioGroup defaultValue="on">
              <MenuRadioItem value="on">Radio, checked</MenuRadioItem>
              <MenuRadioItem value="off">Radio, unchecked</MenuRadioItem>
            </MenuRadioGroup>
          </MenuGroup>
        </MenuPopup>
      </Menu>
    </div>
  ),
};

export const Closed: Story = {
  render: () => (
    <Menu>
      <MoreTrigger />
    </Menu>
  ),
};

export const Open: Story = {
  name: "Open (pull request actions)",
  render: () => (
    <div style={POPUP_ANCHOR}>
      <Menu defaultOpen>
        <MoreTrigger label="Pull request actions" />
        <MenuPopup align="start" className="w-72">
          <MenuItem>
            <HammerIcon className="size-3.5" />
            Fix review findings
          </MenuItem>
          <MenuItem>
            <ScrollTextIcon className="size-3.5" />
            Write guide
          </MenuItem>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuCheckboxItem variant="icon" defaultChecked closeOnClick={false}>
            <span className="flex max-w-xs flex-col gap-0.5">
              <span>Allow edits from maintainers</span>
              <span className="text-xs text-muted-foreground">
                Maintainers can push to this branch. If your fork has workflows, this can also give
                access to its secrets.
              </span>
            </span>
          </MenuCheckboxItem>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuItem>
            <PullRequestGlyph.draft className="size-3.5" />
            Convert to draft
          </MenuItem>
          <MenuItem>
            <PullRequestGlyph.merged className="size-3.5" />
            Merge now
          </MenuItem>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuRadioGroup defaultValue="squash">
            <MenuRadioItem value="merge" closeOnClick>
              <span className="flex min-w-0 items-center gap-2">
                <PullRequestGlyph.merged className="size-3.5" />
                <span>Create a merge commit</span>
              </span>
            </MenuRadioItem>
            <MenuRadioItem value="squash" closeOnClick>
              <span className="flex min-w-0 items-center gap-2">
                <PullRequestGlyph.merged className="size-3.5" />
                <span>Squash and merge</span>
              </span>
            </MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuItem>
            <ArrowUpRightIcon className="size-3.5" />
            Open on GitHub
          </MenuItem>
          <MenuItem>
            <LinkIcon className="size-3.5" />
            Copy link
            <MenuShortcut>⌘⇧C</MenuShortcut>
          </MenuItem>
          <MenuItem>
            <CopyIcon className="size-3.5" />
            Copy PR number
            <MenuShortcut>⌘⇧N</MenuShortcut>
          </MenuItem>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuItem variant="destructive">
            <PullRequestGlyph.closed className="size-3.5" />
            Close pull request
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  ),
};

export const WithSubmenu: Story = {
  name: "Groups and submenu",
  render: () => (
    <div style={{ ...POPUP_ANCHOR, marginRight: 320 }}>
      <Menu defaultOpen modal={false}>
        <MenuTrigger render={<Button variant="ghost" size="xs" />}>
          <LaptopIcon />
          Local
        </MenuTrigger>
        <MenuPopup align="start" className="w-[min(21rem,calc(100vw-2rem))]">
          <MenuGroup>
            <MenuGroupLabel>Run on</MenuGroupLabel>
            <MenuRadioGroup defaultValue="macbook">
              <MenuRadioItem value="auto" closeOnClick>
                <span className="flex min-w-0 items-center gap-1.5">
                  <ScaleIcon className="size-3" aria-hidden="true" />
                  <span className="min-w-0 truncate">Auto balance</span>
                </span>
              </MenuRadioItem>
              <MenuRadioItem value="macbook" closeOnClick>
                <span className="flex min-w-0 items-center gap-1.5">
                  <LaptopIcon className="size-3" />
                  <span className="min-w-0 truncate">MacBook Pro</span>
                </span>
              </MenuRadioItem>
              <MenuRadioItem value="devbox" closeOnClick>
                <span className="flex min-w-0 items-center gap-1.5">
                  <ServerIcon className="size-3" />
                  <span className="min-w-0 truncate">devbox</span>
                </span>
              </MenuRadioItem>
            </MenuRadioGroup>
            <MenuSub defaultOpen>
              <MenuSubTrigger>
                <span className="flex min-w-0 items-center gap-1.5">
                  <PlusIcon className="size-3" />
                  <span className="min-w-0 truncate">Add to another machine</span>
                </span>
              </MenuSubTrigger>
              <MenuSubPopup>
                <MenuItem>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ServerIcon className="size-3" />
                    <span className="min-w-0 truncate">build-server</span>
                  </span>
                </MenuItem>
                <MenuItem>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <LaptopIcon className="size-3" />
                    <span className="min-w-0 truncate">Mac mini</span>
                  </span>
                </MenuItem>
              </MenuSubPopup>
            </MenuSub>
          </MenuGroup>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuGroup>
            <MenuGroupLabel>Workspace</MenuGroupLabel>
            <MenuRadioGroup defaultValue="local">
              <MenuRadioItem value="local" closeOnClick>
                Local
              </MenuRadioItem>
              <MenuRadioItem value="worktree" closeOnClick>
                New worktree
              </MenuRadioItem>
            </MenuRadioGroup>
          </MenuGroup>
        </MenuPopup>
      </Menu>
    </div>
  ),
};

export const TrailingDetail: Story = {
  name: "Trailing detail (snooze)",
  render: () => (
    <div style={POPUP_ANCHOR}>
      <Menu defaultOpen>
        <MoreTrigger label="Snooze thread" />
        <MenuPopup side="bottom" align="end">
          <MenuItem>
            In 1 hour
            <MenuItemDetail>3:45 PM</MenuItemDetail>
          </MenuItem>
          <MenuItem>
            Later today
            <MenuItemDetail>6:00 PM</MenuItemDetail>
          </MenuItem>
          <MenuItem>
            Tomorrow
            <MenuItemDetail>9:00 AM</MenuItemDetail>
          </MenuItem>
          <MenuItem>
            Next week
            <MenuItemDetail>Mon 9:00 AM</MenuItemDetail>
          </MenuItem>
          <MenuSeparator className={FULL_WIDTH_SEPARATOR} />
          <MenuItem>Custom…</MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  ),
};

export const WithSearch: Story = {
  name: "With search input",
  render: () => (
    <div style={POPUP_ANCHOR}>
      <Menu defaultOpen>
        <LabelledTrigger>Author</LabelledTrigger>
        <MenuPopup align="start" className="w-64">
          <MenuSearchInput placeholder="Search authors" aria-label="Search authors" />
          <MenuRadioGroup defaultValue="">
            <MenuRadioItem value="">
              <span className="flex min-w-0 items-center gap-2">
                <LayersIcon aria-hidden className="size-3.5" />
                Anyone
              </span>
            </MenuRadioItem>
            {["octocat", "monalisa", "hubot"].map((login, index) => (
              <MenuRadioItem key={login} value={login}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-3.5 shrink-0 rounded-full bg-muted" />
                  <span className="min-w-0 flex-1 truncate">{login}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {12 - index * 4} merges loaded
                  </span>
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    </div>
  ),
};
