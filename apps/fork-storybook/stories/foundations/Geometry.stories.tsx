import type { Meta, StoryObj } from "@storybook/react-vite";

const RADII = [
  { utility: "rounded-sm", token: "--radius-sm" },
  { utility: "rounded-md", token: "--radius-md" },
  { utility: "rounded-lg", token: "--radius-lg" },
  { utility: "rounded-xl", token: "--radius-xl" },
  { utility: "rounded-2xl", token: "--radius-2xl" },
  { utility: "rounded-3xl", token: "--radius-3xl" },
  { utility: "rounded-[var(--control-radius)]", token: "--control-radius" },
  { utility: "rounded-full", token: "9999px" },
] as const;

const SPACING = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16] as const;

const SHADOWS = [
  { label: "shadow-xs", className: "shadow-xs" },
  { label: "shadow-sm", className: "shadow-sm" },
  { label: "shadow-md", className: "shadow-md" },
  { label: "shadow-lg", className: "shadow-lg" },
  { label: "shadow-xl", className: "shadow-xl" },
  { label: "popup (--basic-popup-shadow)", className: "shadow-(--basic-popup-shadow)" },
  { label: "composer (--shadow-composer)", className: "shadow-(--shadow-composer)" },
] as const;

const meta = {
  title: "Foundations/Geometry",
  parameters: { surface: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Radius: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {RADII.map((radius) => (
        <figure
          key={radius.utility}
          className="flex flex-col items-center gap-2"
          data-radius={radius.token}
        >
          <div className={`size-20 border border-border bg-secondary ${radius.utility}`} />
          <figcaption className="font-mono text-[11px] text-muted-foreground">
            {radius.token}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};

/** Tailwind's 4px spacing unit; the steps components actually use. */
export const Spacing: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {SPACING.map((step) => (
        <div key={step} className="flex items-center gap-4" data-spacing={step * 4}>
          <span className="w-24 font-mono text-[11px] text-muted-foreground">
            {step} · {step * 4}px
          </span>
          <span className="h-3 rounded-sm bg-foreground/70" style={{ width: step * 4 }} />
        </div>
      ))}
    </div>
  ),
};

export const Elevation: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8 p-6">
      {SHADOWS.map((shadow) => (
        <figure key={shadow.label} className="flex flex-col items-center gap-3">
          <div
            className={`size-24 rounded-xl border border-border bg-popover ${shadow.className}`}
          />
          <figcaption className="font-mono text-[11px] text-muted-foreground">
            {shadow.label}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};
