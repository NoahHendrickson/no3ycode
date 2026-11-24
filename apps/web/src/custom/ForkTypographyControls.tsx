/**
 * Typography settings controls — see `.fork/customizations.yaml#fork-typography-settings`.
 *
 * Fork-only rows and the interface font preset picker, kept out of the Typography shadow so
 * each upstream sync hand-merges one element per hunk instead of the controls themselves.
 */
import { useState, type ReactNode } from "react";

import { SettingResetButton, SettingsRow } from "~/components/settings/settingsLayout";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import {
  DEFAULT_FORK_SIDEBAR_FONT_SIZE,
  DEFAULT_FORK_TYPOGRAPHY_SCALE,
  FORK_INTERFACE_FONT_PRESETS,
  FORK_TYPOGRAPHY_SCALE_OPTIONS,
  forkInterfaceFontPreset,
  MAX_FORK_SIDEBAR_FONT_SIZE,
  MIN_FORK_SIDEBAR_FONT_SIZE,
  useForkChatTextScale,
  useForkSidebarFontSize,
} from "./forkTypographyScale";

const CUSTOM = "custom";

/**
 * The preset select, plus upstream's family field while Custom… is chosen or the saved family
 * matches no preset. Custom… is a mode, not a value: the field starts on the saved family, which
 * may be a preset's, so the mode lasts until the family changes (a typed family or a reset).
 */
export function ForkFontPresetPicker({
  title,
  value,
  familyField,
  onPick,
}: {
  readonly title: string;
  readonly value: string;
  readonly familyField: ReactNode;
  readonly onPick: (family: string) => void;
}) {
  const [custom, setCustom] = useState({ picked: false, value });
  if (custom.value !== value) setCustom({ picked: false, value });
  const selected = custom.picked && custom.value === value ? null : forkInterfaceFontPreset(value);
  return (
    // Narrow rows flow like upstream's; beside the label it stacks until all three controls fit.
    <div className="contents @min-[32rem]/settings-row:flex @min-[32rem]/settings-row:flex-col @min-[32rem]/settings-row:gap-2 @min-[46rem]/settings-row:flex-row @min-[46rem]/settings-row:items-center">
      <Select
        value={selected?.label ?? CUSTOM}
        onValueChange={(next) => {
          if (next === CUSTOM) {
            setCustom({ picked: true, value });
            return;
          }
          const preset = FORK_INTERFACE_FONT_PRESETS.find((candidate) => candidate.label === next);
          if (preset === undefined) return;
          onPick(preset.value);
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-full shrink-0 @min-[46rem]/settings-row:w-28"
          aria-label={`${title} preset`}
        >
          <SelectValue>{selected?.label ?? "Custom…"}</SelectValue>
        </SelectTrigger>
        <SelectPopup align="end" alignItemWithTrigger={false}>
          {FORK_INTERFACE_FONT_PRESETS.map((preset) => (
            <SelectItem hideIndicator key={preset.label} value={preset.label}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem hideIndicator value={CUSTOM}>
            Custom…
          </SelectItem>
        </SelectPopup>
      </Select>
      {selected === null ? familyField : null}
    </div>
  );
}

const SIDEBAR_FONT_SIZES = Array.from(
  { length: MAX_FORK_SIDEBAR_FONT_SIZE - MIN_FORK_SIDEBAR_FONT_SIZE + 1 },
  (_, index) => MIN_FORK_SIDEBAR_FONT_SIZE + index,
);

export function ForkSidebarFontSizeRow() {
  const [size, setSize] = useForkSidebarFontSize();
  return (
    <SizeRow
      title="Sidebar font size"
      description="Thread titles, project names, and the rest of the sidebar, separate from the interface font size. Rows grow to fit. Saved on this device."
      value={size}
      defaultValue={DEFAULT_FORK_SIDEBAR_FONT_SIZE}
      options={SIDEBAR_FONT_SIZES}
      format={(px) => `${px} px`}
      onChange={setSize}
    />
  );
}

export function ForkChatStreamSizeRow() {
  const [scale, setScale] = useForkChatTextScale();
  return (
    <SizeRow
      title="Chat stream size"
      description="Text in messages and tool rows. Code follows the code font size. Saved on this device."
      value={scale}
      defaultValue={DEFAULT_FORK_TYPOGRAPHY_SCALE}
      options={FORK_TYPOGRAPHY_SCALE_OPTIONS}
      format={(percent) => `${percent}%`}
      onChange={setScale}
    />
  );
}

function SizeRow<T extends number>({
  title,
  description,
  value,
  defaultValue,
  options,
  format,
  onChange,
}: {
  readonly title: string;
  readonly description: string;
  readonly value: T;
  readonly defaultValue: T;
  readonly options: ReadonlyArray<T>;
  readonly format: (value: T) => string;
  readonly onChange: (value: T) => void;
}) {
  return (
    <SettingsRow
      title={title}
      description={description}
      devicePreference
      resetAction={
        value === defaultValue ? null : (
          <SettingResetButton
            ariaLabel={`Reset ${title.toLowerCase()} to default`}
            onClick={() => onChange(defaultValue)}
          />
        )
      }
      control={
        <Select
          value={String(value)}
          onValueChange={(next) => {
            const picked = options.find((option) => String(option) === next);
            if (picked !== undefined) onChange(picked);
          }}
        >
          <SelectTrigger size="sm" className="w-22 shrink-0" aria-label={title}>
            <SelectValue>{format(value)}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {options.map((option) => (
              <SelectItem hideIndicator key={option} value={String(option)}>
                {format(option)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
