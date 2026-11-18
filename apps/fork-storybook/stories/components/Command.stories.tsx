import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FileSearchIcon,
  FolderIcon,
  MessageSquareIcon,
  PaletteIcon,
  SearchIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandShortcut,
} from "~/components/ui/command";
import { Button } from "~/components/ui/button";
import { Kbd, KbdGroup } from "~/components/ui/kbd";

type PaletteItem = {
  value: string;
  title: string;
  icon: ReactNode;
  description?: string;
  shortcut?: string;
  timestamp?: string;
};
type PaletteGroup = { value: string; label: string; items: ReadonlyArray<PaletteItem> };

const GROUPS: ReadonlyArray<PaletteGroup> = [
  {
    value: "actions",
    label: "Actions",
    items: [
      { value: "new-thread", title: "New thread in...", icon: <SquarePenIcon />, shortcut: "⌘N" },
      { value: "go-to-file", title: "Go to file", icon: <FileSearchIcon />, shortcut: "⌘P" },
      {
        value: "search-contents",
        title: "Search project contents",
        icon: <SearchIcon />,
        shortcut: "⌘⇧F",
      },
      { value: "change-theme", title: "Change theme", icon: <PaletteIcon /> },
    ],
  },
  {
    value: "projects",
    label: "Projects",
    items: [
      {
        value: "project-t3code",
        title: "t3code",
        icon: <FolderIcon />,
        description: "~/code/t3code",
      },
      {
        value: "project-marketing",
        title: "marketing-site",
        icon: <FolderIcon />,
        description: "~/code/marketing-site",
      },
    ],
  },
  {
    value: "recent-threads",
    label: "Recent Threads",
    items: [
      {
        value: "thread-toast",
        title: "Fix flaky toast test",
        icon: <MessageSquareIcon />,
        timestamp: "2h",
      },
      {
        value: "thread-sidebar",
        title: "Sidebar settles without re-sorting",
        icon: <MessageSquareIcon />,
        timestamp: "1d",
      },
    ],
  },
  {
    value: "settings",
    label: "Settings",
    items: [
      { value: "open-settings", title: "Open settings", icon: <SettingsIcon />, shortcut: "⌘," },
    ],
  },
];

function TitleIcon({ children }: { children: ReactNode }) {
  return <span className="flex h-5 shrink-0 items-center self-start pt-0.5">{children}</span>;
}

function PaletteRow({ item }: { item: PaletteItem }) {
  return (
    <CommandItem value={item}>
      <TitleIcon>{item.icon}</TitleIcon>
      {item.description ? (
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
            <span className="truncate">{item.title}</span>
          </span>
          <span className="min-w-0 text-muted-foreground/70 text-xs">{item.description}</span>
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-foreground">
          <span className="truncate">{item.title}</span>
        </span>
      )}
      {item.timestamp ? (
        <span className="min-w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground/70">
          {item.timestamp}
        </span>
      ) : null}
      {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
    </CommandItem>
  );
}

function PaletteFooter() {
  return (
    <CommandFooter className="max-sm:flex-col max-sm:items-start">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <KbdGroup>
          <Kbd>
            <ArrowUpIcon />
          </Kbd>
          <Kbd>
            <ArrowDownIcon />
          </Kbd>
          <span>Navigate</span>
        </KbdGroup>
        <KbdGroup>
          <Kbd>Enter</Kbd>
          <span>Open</span>
        </KbdGroup>
        <KbdGroup>
          <Kbd>Esc</Kbd>
          <span>Close</span>
        </KbdGroup>
      </div>
    </CommandFooter>
  );
}

function Palette({
  groups,
  query,
  placeholder,
}: {
  groups: ReadonlyArray<PaletteGroup>;
  query: string;
  placeholder: string;
}) {
  return (
    <CommandDialogPopup aria-label="Command palette" className="overflow-hidden">
      <Command
        key={query}
        aria-label="Command palette"
        mode="none"
        items={groups}
        defaultValue={query}
      >
        <div className="relative">
          <CommandInput autoFocus={false} placeholder={placeholder} />
        </div>
        <CommandPanel className="flex max-h-[min(28rem,70vh)] min-h-0 flex-col">
          {groups.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No matching commands, projects, or threads.
            </div>
          ) : (
            <CommandList>
              {(group: PaletteGroup) => (
                <CommandGroup items={group.items} key={group.value}>
                  <CommandGroupLabel>{group.label}</CommandGroupLabel>
                  <CommandCollection>
                    {(item: PaletteItem) => <PaletteRow item={item} key={item.value} />}
                  </CommandCollection>
                </CommandGroup>
              )}
            </CommandList>
          )}
        </CommandPanel>
        <PaletteFooter />
      </Command>
    </CommandDialogPopup>
  );
}

const meta = {
  title: "Components/Command",
  // Its first example is an open modal, which inline would cover the whole docs page with.
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
  component: CommandDialogPopup,
  tags: ["autodocs"],
} satisfies Meta<typeof CommandDialogPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

type PlaygroundArgs = { placeholder: string; query: string };

export const Playground: StoryObj<PlaygroundArgs> = {
  args: { placeholder: "Search commands, projects, and threads...", query: "" },
  render: ({ placeholder, query }) => (
    <CommandDialog defaultOpen>
      <Palette groups={GROUPS} query={query} placeholder={placeholder} />
    </CommandDialog>
  ),
};

export const Closed: Story = {
  render: () => (
    <CommandDialog>
      <CommandDialogTrigger render={<Button variant="outline" />}>
        <SearchIcon />
        Search
        <Kbd>⌘K</Kbd>
      </CommandDialogTrigger>
      <Palette groups={GROUPS} query="" placeholder="Search commands, projects, and threads..." />
    </CommandDialog>
  ),
};

export const Open: Story = {
  name: "Open (command palette)",
  render: () => (
    <CommandDialog defaultOpen>
      <Palette groups={GROUPS} query="" placeholder="Search commands, projects, and threads..." />
    </CommandDialog>
  ),
};

export const Empty: Story = {
  name: "Empty state",
  render: () => (
    <CommandDialog defaultOpen>
      <Palette
        groups={[]}
        query="kubernetes"
        placeholder="Search commands, projects, and threads..."
      />
    </CommandDialog>
  ),
};
