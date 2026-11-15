/**
 * The collapsed tab strip's petals — see `.fork/customizations.yaml#fork-bots`: a track of
 * mascots beside the project switcher, apart from the thread tabs, one per petal the sidebar
 * lists. The petal on screen, or whose work is, is pressed; picking one opens its conversation.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useQuietThreadShells } from "~/state/entities";

import { SegmentedTab, SegmentedTabs } from "../SegmentedTabs";
import { BotMascot } from "./BotMascot";
import { botMascotShape } from "./botMascotTags";
import { listSidebarBots } from "./botThreads";
import { openBotThreadsPanel } from "./botThreadsPanelStore";
import { botWorkAttentionByBot } from "./botWork";
import { useBotThreadsPanelBot } from "./useBotWorkOwner";

export function CollapsedPetalTabs(props: {
  readonly openThreadRef: ScopedThreadRef | null;
  readonly onOpen: (threadRef: ScopedThreadRef) => void;
}) {
  const threads = useQuietThreadShells();
  const owner = useBotThreadsPanelBot(props.openThreadRef);
  const petals = listSidebarBots(threads);
  if (petals.length === 0) return null;
  const ownerKey = owner === null ? null : scopedThreadKey(owner);
  return (
    <SegmentedTabs
      aria-label="Petals"
      value={ownerKey === null ? [] : [ownerKey]}
      onValueChange={(value) => {
        // Pressing the lit petal from its work unpresses it; that goes back to its conversation.
        const key = value[0] ?? ownerKey;
        if (key == null) return;
        const petal = petals.find(
          (thread) => scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)) === key,
        );
        if (petal === undefined) return;
        const ref = scopeThreadRef(petal.environmentId, petal.id);
        // As in the sidebar: a petal whose work needs you opens with its Threads panel.
        if (botWorkAttentionByBot(threads).has(key)) openBotThreadsPanel(ref);
        if (props.openThreadRef !== null && scopedThreadKey(props.openThreadRef) === key) return;
        props.onOpen(ref);
      }}
      data-fork-tab-strip-projects=""
      data-fork-tab-strip-petals=""
      className="min-w-0 shrink overflow-x-auto rounded-full [scrollbar-width:none]"
    >
      {petals.map((petal) => {
        const key = scopedThreadKey(scopeThreadRef(petal.environmentId, petal.id));
        return (
          <Tooltip key={key}>
            <TooltipTrigger
              render={
                <SegmentedTab
                  value={key}
                  aria-label={petal.title}
                  data-fork-tab-strip-control=""
                  className="w-7 rounded-full px-0"
                />
              }
            >
              <BotMascot shape={botMascotShape(petal.source)} mood="Idle" fit={18} />
            </TooltipTrigger>
            <TooltipPopup side="bottom">{petal.title}</TooltipPopup>
          </Tooltip>
        );
      })}
    </SegmentedTabs>
  );
}
