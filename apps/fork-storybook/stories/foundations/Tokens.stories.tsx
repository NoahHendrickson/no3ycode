import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { inletTemplateRules, jungleColorRules, type TokenRule } from "./cssRules";

// Each scope renders its swatches under the app's own marker, so a swatch shows the value that
// scope really paints, even where the declared value is a var() or a color-mix().
const SCOPES = [
  {
    name: "Stage",
    match: (s: string) => s.endsWith('[data-fork-inlet-color="jungle"]'),
    attrs: {},
  },
  {
    name: "Frame (sidebar, thread tabs)",
    match: (s: string) => s.endsWith("[data-fork-thread-tabs])"),
    attrs: { "data-sidebar-version": "v2" },
  },
  {
    name: "Page (Settings, utility pages)",
    match: (s: string) => s.includes("[data-app-modal]"),
    attrs: { "data-app-modal": "" },
  },
  {
    name: "Hung menu (dropdowns)",
    match: (s: string) => s.includes("[data-fork-tab-menu]:not("),
    attrs: { "data-slot": "menu-popup", "data-fork-tab-menu": "" },
  },
  {
    name: "Panel (chat column)",
    match: (s: string) => s.endsWith("[data-chat-column-maximized-away]"),
    attrs: { "data-chat-column-maximized-away": "" },
  },
] as const;

function TokenRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,16rem)_minmax(0,1fr)] items-center gap-3 py-1">
      <div
        className="size-8 rounded-md border border-black/10"
        style={{ background: `var(${name})` }}
      />
      <code className="truncate font-mono text-xs">{name}</code>
      <code className="truncate font-mono text-xs opacity-70">{value}</code>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-[#f6f4e4] p-5 text-[#1c1c1a]">
      <h2 className="mb-3 font-medium text-sm">{title}</h2>
      {children}
    </section>
  );
}

// A scope can be declared in more than one sheet; later declarations win, as in the cascade.
function scopeTokens(rules: readonly TokenRule[]) {
  const tokens = new Map<string, string>();
  for (const rule of rules) for (const { name, value } of rule.tokens) tokens.set(name, value);
  return [...tokens];
}

function JungleColors() {
  return (
    <div className="flex flex-col gap-4">
      {SCOPES.map((scope) => (
        <Section key={scope.name} title={scope.name}>
          <div {...scope.attrs} className="m-0! bg-transparent! bg-none! text-[#1c1c1a]!">
            {scopeTokens(jungleColorRules.filter((rule) => scope.match(rule.selector))).map(
              ([name, value]) => (
                <TokenRow key={name} name={name} value={value} />
              ),
            )}
          </div>
        </Section>
      ))}
    </div>
  );
}

function GeometryTable() {
  const lengths = new Map<string, Set<string>>();
  for (const rule of inletTemplateRules) {
    for (const { name, value } of rule.tokens) {
      if (!name.startsWith("--fork-inlet-") || !/^-?\d+(\.\d+)?px$/.test(value)) continue;
      lengths.set(name, (lengths.get(name) ?? new Set()).add(value));
    }
  }
  return (
    <Section title="Geometry: every --fork-inlet-* length the template declares">
      {[...lengths].map(([name, values]) => (
        <div
          key={name}
          className="grid grid-cols-[minmax(0,16rem)_5rem_minmax(0,1fr)] items-center gap-3 py-1"
        >
          <code className="font-mono text-xs">{name}</code>
          <code className="font-mono text-xs opacity-70">{[...values].join(" / ")}</code>
          <div className="h-2 rounded-full bg-[#21835c]" style={{ width: [...values][0] }} />
        </div>
      ))}
    </Section>
  );
}

const meta = {
  title: "Foundations/Tokens",
  parameters: { surface: "stage" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = { render: () => <JungleColors /> };

export const Geometry: Story = { render: () => <GeometryTable /> };
