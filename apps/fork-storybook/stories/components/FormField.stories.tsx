import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import { DraftInput } from "~/components/ui/draft-input";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "~/components/ui/number-field";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { SettingsRow, SettingsSection } from "~/components/settings/settingsLayout";

const PROJECT_ORDER = {
  updated_at: "Last user message",
  created_at: "Created at",
  manual: "Manual",
} as const;

const PERMISSIONS = [
  {
    title: "View environment",
    description: "Read threads, status, checkpoints, and configuration.",
  },
  { title: "Operate tasks", description: "Start, update, and stop tasks." },
  {
    title: "Change environment settings",
    description: "Edit environment preferences and keybindings.",
  },
] as const;

// ScheduledTaskEditor's local Field: the label row carries an optional hint on its right.
function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-baseline justify-between" htmlFor={htmlFor}>
        <span>{label}</span>
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </Label>
      {children}
    </div>
  );
}

const meta = {
  title: "Components/Form Field",
  tags: ["autodocs"],
  parameters: { surface: "page" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LabelControlDescription: Story = {
  name: "Label, control, description",
  render: () => (
    <form className="grid w-96 gap-4" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-1.5">
        <Label htmlFor="story-provider-name">Name</Label>
        <Input
          id="story-provider-name"
          placeholder="Personal"
          defaultValue="Personal"
          maxLength={64}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="story-provider-account">Account</Label>
        <Input
          id="story-provider-account"
          placeholder="my.1password.com"
          maxLength={253}
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          The account shorthand, sign-in address without https://, or ID that op account list shows.
        </p>
      </div>
    </form>
  ),
};

export const WithError: Story = {
  name: "With error",
  render: () => (
    <form className="grid w-96 gap-4" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-1.5">
        <Label htmlFor="story-provider-name-error">Name</Label>
        <Input
          id="story-provider-name-error"
          placeholder="Personal"
          aria-invalid
          aria-describedby="story-provider-name-error-text"
        />
        <p id="story-provider-name-error-text" role="alert" className="text-xs text-destructive">
          Enter a name.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="story-provider-account-error">Account</Label>
        <Input
          id="story-provider-account-error"
          defaultValue="https://my.1password.com"
          spellCheck={false}
          aria-invalid
          aria-describedby="story-provider-account-error-text"
        />
        <p id="story-provider-account-error-text" role="alert" className="text-xs text-destructive">
          Leave out https://.
        </p>
        <p className="text-xs text-muted-foreground">
          The account shorthand, sign-in address without https://, or ID that op account list shows.
        </p>
      </div>
    </form>
  ),
};

export const WithHint: Story = {
  name: "Label with hint",
  render: () => (
    <div className="flex w-[28rem] flex-col gap-4">
      <Field label="Skip requests older than" hint="minutes, optional" htmlFor="story-max-age">
        <Input
          id="story-max-age"
          type="number"
          nativeInput
          min={1}
          placeholder="Run every request"
        />
      </Field>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="story-signature">Require signature</Label>
          <p className="text-sm text-muted-foreground">
            Reject requests without a valid HMAC-SHA256 signature of the body.
          </p>
        </div>
        <Switch id="story-signature" defaultChecked />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Header" htmlFor="story-signature-header">
          <Input id="story-signature-header" defaultValue="X-Hub-Signature-256" />
        </Field>
        <Field label="Prefix" htmlFor="story-signature-prefix">
          <Input id="story-signature-prefix" defaultValue="sha256=" placeholder="None" />
        </Field>
        <Field label="Encoding" htmlFor="story-signature-encoding">
          <Select defaultValue="hex">
            <SelectTrigger size="sm" id="story-signature-encoding">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="hex">hex</SelectItem>
              <SelectItem value="base64">base64</SelectItem>
            </SelectPopup>
          </Select>
        </Field>
        <Field label="Secret" htmlFor="story-signature-secret">
          <Input
            id="story-signature-secret"
            type="password"
            autoComplete="off"
            placeholder="Shared secret"
          />
        </Field>
      </div>
    </div>
  ),
};

export const WrappingLabels: Story = {
  name: "Wrapping labels in a grid",
  render: () => (
    <div className="grid w-[28rem] grid-cols-1 gap-3 sm:grid-cols-2">
      <NumberField id="story-snooze-amount" min={0} step="any" defaultValue={2}>
        <Label htmlFor="story-snooze-amount">Snooze for</Label>
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label="Decrease duration" />
          <NumberFieldInput required />
          <NumberFieldIncrement aria-label="Increase duration" />
        </NumberFieldGroup>
      </NumberField>
      <Label className="flex min-w-0 flex-col items-stretch" htmlFor="story-snooze-unit">
        Unit
        <Select defaultValue="hours" items={{ minutes: "Minutes", hours: "Hours", days: "Days" }}>
          <SelectTrigger id="story-snooze-unit" className="min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
            <SelectItem value="days">Days</SelectItem>
          </SelectPopup>
        </Select>
      </Label>
      <p role="alert" className="col-span-full text-xs text-destructive">
        Choose a time in the future.
      </p>
    </div>
  ),
};

export const OptionGroup: Story = {
  name: "Option group with validation",
  render: () => (
    <section className="w-96 space-y-2">
      <span className="block text-xs font-medium text-foreground">Permissions</span>
      <div className="divide-y divide-border/60 rounded-lg border border-input bg-muted/25">
        {PERMISSIONS.map(({ title, description }) => (
          <label
            key={title}
            className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
          >
            <Checkbox className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{title}</span>
              <span className="block text-xs leading-snug text-muted-foreground">
                {description}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-destructive">Select at least one permission.</p>
    </section>
  ),
};

export const SettingsRows: Story = {
  name: "Settings rows",
  render: () => (
    <div className="w-[44rem]">
      <SettingsSection title="Sidebar">
        <SettingsRow
          title="Project order"
          description="Order of projects in the sidebar project picker and command palette."
          control={
            <Select defaultValue="updated_at" items={PROJECT_ORDER}>
              <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Project order">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {Object.entries(PROJECT_ORDER).map(([value, label]) => (
                  <SelectItem hideIndicator key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          }
        />
        <SettingsRow
          title="Working section"
          description="Fold working and monitoring threads into a Working section. They return to the top of the inbox when they need you."
          control={<Switch defaultChecked aria-label="Working section" />}
        />
        <SettingsRow
          title="Add project starts in"
          description='Leave empty to use "~/" when the Add Project browser opens.'
          control={
            <DraftInput
              size="sm"
              className="w-full sm:w-72"
              value=""
              onCommit={() => undefined}
              placeholder="~/"
              spellCheck={false}
              aria-label="Add project base directory"
            />
          }
        />
        <SettingsRow
          title="Thread title instructions"
          description="Appended to the prompt for new and regenerated thread titles."
        >
          <div className="mt-3 max-w-2xl pb-3.5">
            <Textarea
              aria-label="Thread title instructions"
              rows={4}
              placeholder="Keep titles to a few words. Lead with the main subject."
            />
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  ),
};
