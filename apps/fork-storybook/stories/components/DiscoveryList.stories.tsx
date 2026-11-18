import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Globe, History, RadioTower, Smartphone } from "lucide-react";

import { Button } from "~/components/ui/button";
import { DiscoveryList, DiscoveryListRow } from "~/components/ui/discovery-list";

import { forcedStateProps } from "../forcedStates.ts";

const SERVERS = [
  { title: "vite", port: 5173 },
  { title: "next-server", port: 3000 },
  { title: "Listening", port: 8787 },
] as const;

function Favicon() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border/60">
      <Globe className="size-4 text-muted-foreground" />
    </span>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <h2 className="font-medium">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const meta = {
  title: "Components/Discovery List",
  component: DiscoveryList,
  tags: ["autodocs"],
  args: { children: null },
  render: () => (
    <div className="w-[36rem]">
      <DiscoveryList>
        {SERVERS.map((server) => (
          <DiscoveryListRow
            key={server.port}
            icon={<Favicon />}
            title={server.title}
            description={`localhost:${server.port}`}
          />
        ))}
      </DiscoveryList>
    </div>
  ),
} satisfies Meta<typeof DiscoveryList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <div className="w-[36rem]">
      <DiscoveryList>
        {(["default", "hover", "focus", "disabled"] as const).map((state) => (
          <DiscoveryListRow
            key={state}
            icon={<Favicon />}
            title={state}
            description="localhost:5173"
            {...forcedStateProps(state)}
          />
        ))}
      </DiscoveryList>
    </div>
  ),
};

export const PreviewStart: Story = {
  name: "Preview start page",
  render: () => (
    <div className="flex w-[36rem] flex-col gap-6">
      <Section icon={<History className="size-4 shrink-0" />} title="Recently used">
        <DiscoveryList>
          <DiscoveryListRow
            icon={<Favicon />}
            title="Dashboard · Acme"
            description="localhost:5173/dashboard · 4 minutes ago"
          />
          <DiscoveryListRow
            icon={<Favicon />}
            title="localhost:3000/settings/profile?tab=security"
            description="Yesterday"
          />
        </DiscoveryList>
      </Section>
      <Section icon={<RadioTower className="size-4 shrink-0" />} title="Local servers">
        <DiscoveryList>
          {SERVERS.map((server) => (
            <DiscoveryListRow
              key={server.port}
              icon={<Favicon />}
              title={server.title}
              description={`localhost:${server.port}`}
            />
          ))}
        </DiscoveryList>
        <p className="px-1 text-xs text-muted-foreground">
          Select a live local server to open it in this browser tab.
        </p>
      </Section>
    </div>
  ),
};

export const WithActions: Story = {
  name: "Rows with actions",
  render: () => (
    <div className="w-[36rem]">
      <Section icon={<Smartphone className="size-4 shrink-0" />} title="iOS">
        <DiscoveryList>
          {[
            { name: "iPhone 17 Pro", detail: "MacBook Pro · iOS 26.1 · Running", booted: true },
            {
              name: "iPad Air 13-inch (M3)",
              detail: "MacBook Pro · iOS 26.1 · Stopped",
              booted: false,
            },
          ].map((device) => (
            <div key={device.name} className="flex items-center gap-3 px-3 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border/60">
                <Smartphone className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{device.name}</span>
                <span className="truncate text-xs text-muted-foreground">{device.detail}</span>
              </div>
              <Button size="sm" variant={device.booted ? "default" : "outline"}>
                {device.booted ? "Open" : "Boot"}
              </Button>
            </div>
          ))}
        </DiscoveryList>
      </Section>
    </div>
  ),
};
