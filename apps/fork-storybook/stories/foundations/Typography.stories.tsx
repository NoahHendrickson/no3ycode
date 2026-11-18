import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useRef, useState } from "react";

// The type ramp as components use it: Tailwind's text-* utilities (index.css adds 2xs–5xs below
// xs, and the fork's v2 sidebar remaps xs and sm to 13px), in Geist and Geist Mono.
const SCALE = [
  { utility: "text-5xs", sample: "Micro badge" },
  { utility: "text-4xs", sample: "Micro badge" },
  { utility: "text-3xs", sample: "Status caption" },
  { utility: "text-2xs", sample: "Kbd and meta" },
  { utility: "text-xs", sample: "Captions and chips" },
  { utility: "text-sm", sample: "Body, menus and controls" },
  { utility: "text-base", sample: "Prompt and messages" },
  { utility: "text-lg", sample: "Dialog titles" },
  { utility: "text-xl", sample: "Page headings" },
  { utility: "text-2xl", sample: "Empty states" },
] as const;

const WEIGHTS = [
  { utility: "font-normal", label: "Regular 400" },
  { utility: "font-medium", label: "Medium 500" },
  { utility: "font-semibold", label: "Semibold 600" },
  { utility: "font-bold", label: "Bold 700" },
] as const;

interface Metrics {
  readonly size: string;
  readonly lineHeight: string;
  readonly family: string;
}

function Specimen({ utility, sample, mono }: { utility: string; sample: string; mono: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const style = getComputedStyle(ref.current);
    setMetrics({
      size: style.fontSize,
      lineHeight: style.lineHeight,
      family: style.fontFamily.split(",")[0]!.replaceAll('"', ""),
    });
  }, []);
  return (
    <div
      className="grid grid-cols-[10rem_1fr] items-baseline gap-6 border-b border-border py-4"
      data-type-style={utility}
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[12px] text-foreground">{utility}</span>
        {metrics ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {metrics.size} / {metrics.lineHeight} · {metrics.family}
          </span>
        ) : null}
      </div>
      <p ref={ref} className={`${utility} ${mono ? "font-mono" : ""} text-foreground`}>
        {sample}
      </p>
    </div>
  );
}

const meta = {
  title: "Foundations/Typography",
  parameters: { surface: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sans: Story = {
  render: () => (
    <div className="max-w-3xl">
      {SCALE.map((entry) => (
        <Specimen key={entry.utility} {...entry} mono={false} />
      ))}
    </div>
  ),
};

export const Mono: Story = {
  render: () => (
    <div className="max-w-3xl">
      {SCALE.slice(2, 7).map((entry) => (
        <Specimen
          key={entry.utility}
          utility={entry.utility}
          sample="git checkout -b t3/basic"
          mono
        />
      ))}
    </div>
  ),
};

export const Weights: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {WEIGHTS.map((weight) => (
        <p key={weight.utility} className={`${weight.utility} text-xl text-foreground`}>
          {weight.label} — The quick brown fox
        </p>
      ))}
    </div>
  ),
};

export const Inks: Story = {
  name: "Text colours",
  render: () => (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-foreground">foreground — primary text</p>
      <p className="text-secondary-label">secondary-label — supporting labels</p>
      <p className="text-muted-foreground">muted-foreground — descriptions and meta</p>
      <p className="text-placeholder">placeholder — empty inputs</p>
      <p className="text-destructive-foreground">destructive-foreground — errors</p>
      <p className="text-success-foreground">success-foreground — confirmations</p>
      <p className="text-warning-foreground">warning-foreground — warnings</p>
      <p className="text-info-foreground">info-foreground — notices</p>
    </div>
  ),
};

/** The v2 sidebar remaps text-xs and text-sm to 13px, so the same utility reads larger there. */
export const SidebarScale: Story = {
  name: "Sidebar scale",
  parameters: { surface: "sidebar" },
  render: () => (
    <div className="w-[640px]">
      {SCALE.slice(3, 7).map((entry) => (
        <Specimen key={entry.utility} {...entry} mono={false} />
      ))}
    </div>
  ),
};
