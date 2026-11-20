/* The model picker's provider marks, see `.fork/customizations.yaml#fork-model-picker`.
   Codex's art is a one-colour cloud, so it masks a solid purple over a white patch that fills
   the prompt cutout. Other providers keep their instance icon. Hosts restyle the two fork
   marks only through --fork-mark-ink, --fork-mark-cutout and --fork-mark-size. */
import { ProviderDriverKind } from "@t3tools/contracts";
import type { CSSProperties, JSX } from "react";

import { ProviderInstanceIcon } from "~/components/chat/ProviderInstanceIcon";
import { cn } from "~/lib/utils";
import type { ProviderInstanceEntry } from "~/providerInstances";
import codexMarkUrl from "../assets/codex-mark.png";

export const CLAUDE_INK = "#D97757";
export const CODEX_INK = "#8680ff";
const MARK_SIZE = "var(--fork-mark-size, 1rem)";

const CLAUDE_MARK_STYLE: CSSProperties = {
  width: MARK_SIZE,
  fill: `var(--fork-mark-ink, ${CLAUDE_INK})`,
};
const CODEX_MARK_STYLE: CSSProperties = { width: MARK_SIZE, height: MARK_SIZE };
const CODEX_PATCH_STYLE: CSSProperties = { backgroundColor: "var(--fork-mark-cutout, #fff)" };
const CODEX_CLOUD_STYLE: CSSProperties = {
  maskImage: `url(${codexMarkUrl})`,
  maskSize: "contain",
  maskRepeat: "no-repeat",
  maskPosition: "center",
  backgroundColor: `var(--fork-mark-ink, ${CODEX_INK})`,
};

function ClaudeCodeMark() {
  return (
    <svg viewBox="0 0 256 161" className="shrink-0" style={CLAUDE_MARK_STYLE} aria-hidden>
      <path d="M223.979 63.79H256v33.087h-32v32.299h-15.861v31.157H192v-31.157h-15.861v31.157H160v-31.157H96v31.157H79.872v-31.157H64v31.157H47.861v-31.157H32v-32.31H0V63.8h32V.333h191.979zM64 63.79h15.872V33.42H64zm112.107 0H192V33.42h-15.893z" />
    </svg>
  );
}

function CodexMark() {
  return (
    <span className="relative shrink-0" style={CODEX_MARK_STYLE} aria-hidden>
      {/* Inset a quarter, so it stays inside the cloud and shows only through the prompt. */}
      <span className="absolute inset-1/4" style={CODEX_PATCH_STYLE} />
      <span className="absolute inset-0" style={CODEX_CLOUD_STYLE} />
    </span>
  );
}

const FORK_MARK_BY_DRIVER: Partial<Record<ProviderDriverKind, () => JSX.Element>> = {
  [ProviderDriverKind.make("claudeAgent")]: ClaudeCodeMark,
  [ProviderDriverKind.make("codex")]: CodexMark,
};

/** True when the fork draws its own mark for a driver (Codex's cloud, Claude's mark). */
export function hasForkProviderMark(driver: ProviderDriverKind): boolean {
  return FORK_MARK_BY_DRIVER[driver] !== undefined;
}

/** The fork's own mark for a driver, sized by --fork-mark-size; nothing for other providers. */
export function ForkProviderMark(props: { readonly driver: ProviderDriverKind }) {
  const Mark = FORK_MARK_BY_DRIVER[props.driver];
  return Mark ? <Mark /> : null;
}

/** The fork marks' brand colours, for a host that tints a surface behind them. */
export const FORK_MARK_INK_BY_DRIVER: Partial<Record<ProviderDriverKind, string>> = {
  [ProviderDriverKind.make("claudeAgent")]: CLAUDE_INK,
  [ProviderDriverKind.make("codex")]: CODEX_INK,
};

export function ModelPickerProviderGlyph(props: {
  readonly entry: ProviderInstanceEntry;
  /** Set when several instances share a driver, so the initials tell them apart. */
  readonly showBadge: boolean;
  readonly className?: string | undefined;
  readonly iconClassName?: string | undefined;
  readonly indicatorBackground?: string | undefined;
  readonly badgeClassName?: string | undefined;
}) {
  const { entry } = props;
  const Mark = FORK_MARK_BY_DRIVER[entry.driverKind];
  const icon = (className: string, iconClassName: string) => (
    <ProviderInstanceIcon
      driverKind={entry.driverKind}
      displayName={entry.displayName}
      accentColor={entry.accentColor}
      acpRegistryAgentId={entry.acpRegistryAgentId}
      acpRegistryIconUrl={entry.acpRegistryIconUrl}
      showBadge={props.showBadge}
      className={className}
      iconClassName={iconClassName}
      indicatorBackground={props.indicatorBackground ?? "var(--popover)"}
      badgeClassName={
        props.badgeClassName ?? "right-[-0.25rem] bottom-[-0.25rem] h-3 min-w-3 px-0.5 text-[7px]"
      }
    />
  );
  if (!Mark) return icon(cn("size-4", props.className), cn("size-4", props.iconClassName));
  // Upstream's icon with its glyph hidden, laid over the mark, draws the badge.
  return (
    <span
      className={cn(
        "relative inline-flex size-4 shrink-0 items-center justify-center",
        props.className,
      )}
    >
      <span className={cn("inline-flex items-center justify-center", props.iconClassName)}>
        <Mark />
      </span>
      {props.showBadge ? icon("absolute inset-0", "hidden") : null}
    </span>
  );
}
