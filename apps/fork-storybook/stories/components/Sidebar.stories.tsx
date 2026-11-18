import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BotIcon,
  FolderIcon,
  GitBranchIcon,
  KeyboardIcon,
  MessageSquareIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "~/components/ui/sidebar";

import { type ForcedState, forcedStateProps } from "../forcedStates.ts";
import { Matrix, Stack } from "../Specimen.tsx";

const VARIANTS = ["default", "outline"] as const;
const SIZES = ["sm", "default", "lg", "icon"] as const;
const COLUMNS = ["default", "hover", "active", "focus", "disabled", "selected"] as const;
type Column = (typeof COLUMNS)[number];

const columnProps = (column: Column) =>
  column === "selected" ? { isActive: true } : forcedStateProps(column satisfies ForcedState);

const SETTINGS_GROUPS = [
  {
    heading: "App",
    items: [
      { label: "General", Icon: SettingsIcon },
      { label: "Appearance", Icon: PaletteIcon },
      { label: "Chat", Icon: MessageSquareIcon },
      { label: "Keybindings", Icon: KeyboardIcon },
    ],
  },
  {
    heading: "Agents",
    items: [
      { label: "Providers", Icon: BotIcon },
      { label: "Worktrees", Icon: GitBranchIcon },
      { label: "Environments", Icon: ServerIcon },
      { label: "Archive", Icon: ArchiveIcon },
    ],
  },
] as const;

function SearchRow({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground">
      <SearchIcon className="size-4 shrink-0 text-sidebar-muted-foreground/80" />
      <SidebarInput nativeInput type="text" placeholder={placeholder} />
    </div>
  );
}

function SettingsNav({ active = "Appearance" }: { active?: string }) {
  return (
    <div className="flex flex-col gap-4">
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.heading} className="flex flex-col gap-1">
          <h3 className="px-2 text-xs font-medium text-sidebar-muted-foreground/80 group-data-[collapsible=icon]:sr-only">
            {group.heading}
          </h3>
          <SidebarMenu>
            {group.items.map(({ label, Icon }) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton isActive={label === active} tooltip={label}>
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      ))}
    </div>
  );
}

// The provider fills the canvas the way it fills the window; -m-10 cancels the bare canvas padding.
function AppFrame({
  children,
  defaultOpen = true,
  collapsible = "offcanvas",
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: "offcanvas" | "icon";
}) {
  return (
    <SidebarProvider defaultOpen={defaultOpen} className="-m-10 min-h-screen">
      <Sidebar
        side="left"
        collapsible={collapsible}
        data-app-sidebar=""
        data-sidebar-version="v2"
        aria-label="Settings"
      >
        {children}
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-3">
          <SidebarTrigger className="[&_svg]:size-4!" aria-label="Toggle main sidebar" />
          <span className="text-sm font-medium">Appearance</span>
        </header>
        <div className="p-6 text-sm text-muted-foreground">Settings page content.</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const meta = {
  title: "Components/Sidebar",
  component: SidebarMenuButton,
  tags: ["autodocs"],
  parameters: { surface: "app-sidebar" },
  args: { variant: "default", size: "default", isActive: false },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    size: { control: "select", options: SIZES },
    isActive: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  render: (args) => (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton {...args}>
            <PaletteIcon />
            {args.size === "icon" ? null : <span>Appearance</span>}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  ),
} satisfies Meta<typeof SidebarMenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <SidebarGroup>
      <Stack gap={4}>
        {VARIANTS.map((variant) => (
          <div key={variant} className="flex flex-col gap-1">
            <span className="px-2 font-mono text-[11px] text-sidebar-muted-foreground">
              {variant}
            </span>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton variant={variant}>
                  <FolderIcon />
                  <span>web-dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton variant={variant} isActive>
                  <FolderIcon />
                  <span>t3code</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        ))}
      </Stack>
    </SidebarGroup>
  ),
};

export const Sizes: Story = {
  render: () => (
    <SidebarGroup>
      <Stack gap={4}>
        {SIZES.map((size) => (
          <div key={size} className="flex flex-col gap-1">
            <span className="px-2 font-mono text-[11px] text-sidebar-muted-foreground">{size}</span>
            <SidebarMenu className={size === "icon" ? "flex-row" : undefined}>
              <SidebarMenuItem>
                <SidebarMenuButton size={size} aria-label="New thread">
                  {size === "lg" ? <ServerIcon /> : <SquarePenIcon />}
                  {size === "icon" ? null : (
                    <span>{size === "lg" ? "MacBook Pro" : "New thread"}</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {size === "icon" ? (
                <SidebarMenuItem>
                  <SidebarMenuButton size="icon" aria-label="Settings">
                    <SettingsIcon />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </div>
        ))}
      </Stack>
    </SidebarGroup>
  ),
};

export const States: Story = {
  parameters: { surface: "sidebar" },
  render: () => (
    <SidebarProvider className="min-h-0 w-auto">
      <Matrix
        rows={VARIANTS}
        columns={COLUMNS}
        cell={(variant, column) => (
          <div className="w-28">
            <SidebarMenuButton variant={variant} {...columnProps(column)}>
              <SettingsIcon />
              <span>General</span>
            </SidebarMenuButton>
          </div>
        )}
      />
    </SidebarProvider>
  ),
};

export const SettingsNavigation: Story = {
  name: "Settings navigation",
  render: () => (
    <SidebarGroup>
      <div className="flex flex-col gap-2">
        <SearchRow placeholder="Search settings" />
        <SettingsNav />
      </div>
    </SidebarGroup>
  ),
};

export const SubMenu: Story = {
  name: "Sub menu",
  render: () => (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <FolderIcon />
            <span>t3code</span>
          </SidebarMenuButton>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton href="#">
                <span>Fix terminal resize flicker</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton href="#" isActive>
                <span>Sidebar shelves for working threads</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton href="#" size="sm">
                <span>Bump effect to 4.1</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <FolderIcon />
            <span>web-dashboard</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  ),
};

export const AppFrameOpen: Story = {
  name: "App frame",
  parameters: { surface: "bare" },
  render: () => (
    <AppFrame>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <ArrowLeftIcon />
              <span>Back</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex flex-col gap-2">
            <SearchRow placeholder="Search settings" />
            <SettingsNav />
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="flex-row items-center">
          <SidebarMenuItem>
            <SidebarMenuButton size="icon" aria-label="New project">
              <PlusIcon />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="icon" aria-label="Settings" isActive>
              <SettingsIcon />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </AppFrame>
  ),
};

export const CollapsedToIcons: Story = {
  name: "Collapsed to icons",
  parameters: { surface: "bare" },
  render: () => (
    <AppFrame defaultOpen={false} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SettingsNav />
        </SidebarGroup>
      </SidebarContent>
    </AppFrame>
  ),
};

export const Collapsed: Story = {
  name: "Collapsed (offcanvas)",
  parameters: { surface: "bare" },
  render: () => (
    <AppFrame defaultOpen={false}>
      <SidebarContent>
        <SidebarGroup>
          <SettingsNav />
        </SidebarGroup>
      </SidebarContent>
    </AppFrame>
  ),
};
