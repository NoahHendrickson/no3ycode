/**
 * Live status for subagent thread links in a message — see
 * `.fork/customizations.yaml#no3y-subagent-link-chip`. A live child is always in the shell; an idle
 * one is left out of it, so its row comes from one read of the message's thread family.
 */
import { useAtomValue } from "@effect/atom-react";
import {
  presentThreadShell,
  type EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import { selectEnvironmentQueryData } from "@t3tools/client-runtime/state/runtime";
import { isLiveSubagentShell, type EnvironmentId, type ThreadId } from "@t3tools/contracts";
import { hasThreadLinks, parseThreadLinkHref } from "@t3tools/shared/threadLinks";
import { Atom } from "effect/reactivity";
import { useEffect } from "react";
import type { ImageSourcePropType } from "react-native";

import type { MarkdownLinkCustomization } from "../src/native/SelectableMarkdownText.types";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { appAtomRegistry } from "../src/state/atom-registry";
import { resolveThreadLink } from "../src/state/entities";
import {
  environmentThreadShells,
  shellThreadRemovedSequenceAtom,
  threadFamilies,
} from "../src/state/threads";
import { flatGlassPalette, flatGlassStatusColor } from "./flatGlassTheme";
import {
  dropPeriodAfterSubagentChips,
  isNo3ySubagentChipThread,
  no3ySubagentChipHrefs,
  no3ySubagentChipKind,
  no3ySubagentChipLabel,
  type No3ySubagentChipKind,
} from "./no3ySubagentLinkChip";

interface SubagentLinkChip {
  readonly kind: No3ySubagentChipKind | null;
  /** Unset for an empty title, so the pill keeps the link's text. */
  readonly label: string | undefined;
}

interface SubagentLinkChips {
  readonly chips: ReadonlyMap<string, SubagentLinkChip>;
  /** Set when the family read predates a child going idle, keyed by the stale row. */
  readonly staleKey: string | null;
}

const NO_CHIPS: SubagentLinkChips = { chips: new Map(), staleKey: null };
const NO_CHIPS_ATOM = Atom.make(NO_CHIPS).pipe(Atom.withLabel("no3y-subagent-link-chips:empty"));

// A stale read is refreshed once per row snapshot, so a server that disagrees cannot loop.
const refreshedFamilies = new Set<string>();

// Status marks from No3yStatusMark, drawn white so the pill tints them.
const MARK_ICONS: Record<"working" | "dot" | "half" | "idle", ImageSourcePropType> = {
  working: require("./assets/status-marks/working.png"),
  dot: require("./assets/status-marks/dot.png"),
  half: require("./assets/status-marks/half.png"),
  idle: require("./assets/status-marks/idle.png"),
};

function markIcon(kind: No3ySubagentChipKind | null): ImageSourcePropType {
  if (kind === "working") return MARK_ICONS.working;
  if (kind === "approval" || kind === "input") return MARK_ICONS.half;
  return kind === null ? MARK_ICONS.idle : MARK_ICONS.dot;
}

const subagentLinkChipsAtom = Atom.family((key: string) => {
  const [environmentId, familyThreadId, hrefs] = JSON.parse(key) as [
    EnvironmentId,
    ThreadId | null,
    ReadonlyArray<string>,
  ];
  return Atom.make((get): SubagentLinkChips => {
    const chips = new Map<string, SubagentLinkChip>();
    let staleKey: string | null = null;
    // Read only when a link misses the shell; it covers every child of the message's thread.
    const family = () =>
      familyThreadId === null
        ? null
        : selectEnvironmentQueryData(get(threadFamilies.familyAtom(environmentId, familyThreadId)));
    for (const href of hrefs) {
      const link = parseThreadLinkHref(href);
      if (!link) continue;
      const ref = resolveThreadLink(get, link, environmentId);
      if (!ref) continue;
      let shell: EnvironmentThreadShell | null = get(environmentThreadShells.threadShellAtom(ref));
      let staleRow = false;
      if (shell === null && ref.environmentId === environmentId) {
        const read = family();
        const row = read?.threads.find((thread) => thread.id === ref.threadId);
        shell = row ? presentThreadShell(environmentId, row) : null;
        // The read predates the shell dropping the child (idle, archived), or the shell keeps every
        // live child, so a live row it lacks is older than the child idling.
        const removed = get(
          shellThreadRemovedSequenceAtom(JSON.stringify([environmentId, ref.threadId])),
        );
        if (row && read && (removed > read.snapshotSequence || isLiveSubagentShell(row))) {
          staleRow = true;
          staleKey = `${environmentId}:${familyThreadId}:${row.id}:${read.snapshotSequence}`;
        }
      }
      if (!shell || !isNo3ySubagentChipThread(shell)) continue;
      chips.set(href, {
        kind: staleRow ? null : no3ySubagentChipKind(shell),
        label: shell.title.trim() ? no3ySubagentChipLabel(shell.title) : undefined,
      });
    }
    return chips.size === 0 && staleKey === null ? NO_CHIPS : { chips, staleKey };
  }).pipe(Atom.withLabel(`no3y-subagent-link-chips:${key}`));
});

/** The message's markdown without the period after a chip, and each chip's capsule. */
export function useNo3ySubagentLinkChips(
  environmentId: EnvironmentId,
  /** The thread the message is in; its family holds the idle children it links to. */
  familyThreadId: ThreadId | null,
  markdown: string,
  streaming: boolean,
): {
  readonly markdown: string;
  readonly customization: (href: string) => MarkdownLinkCustomization | undefined;
} {
  const { themeAppearance } = useAppearancePreferences();
  const hrefs = hasThreadLinks(markdown) ? no3ySubagentChipHrefs(markdown) : [];
  const { chips, staleKey } = useAtomValue(
    hrefs.length === 0
      ? NO_CHIPS_ATOM
      : subagentLinkChipsAtom(JSON.stringify([environmentId, familyThreadId, hrefs])),
  );
  // Re-reads a family RPC whose cached rows predate a child going idle.
  useEffect(() => {
    if (staleKey === null || familyThreadId === null || refreshedFamilies.has(staleKey)) return;
    refreshedFamilies.add(staleKey);
    threadFamilies.refresh(appAtomRegistry, environmentId, familyThreadId);
  }, [staleKey, environmentId, familyThreadId]);
  const palette = flatGlassPalette(themeAppearance);
  return {
    markdown:
      chips.size === 0 ? markdown : dropPeriodAfterSubagentChips(markdown, chips.keys(), streaming),
    customization: (href) => {
      const chip = chips.get(href);
      if (!chip) return undefined;
      return {
        label: chip.label,
        icon: markIcon(chip.kind),
        iconTintColor:
          chip.kind === null ? palette.statusIdleBorder : flatGlassStatusColor(chip.kind, palette),
        capsule: { surface: palette.controlSurface, border: palette.controlBorder },
      };
    },
  };
}
