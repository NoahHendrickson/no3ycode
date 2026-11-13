/** A bot's mascot picker in the thread details card — see `.fork/customizations.yaml#fork-bots`. */
import { AuthOrchestrationOperateScope, type ScopedThreadRef } from "@t3tools/contracts";

import { ThreadDetailsSection } from "~/components/chat/ThreadDetailsSection";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentScope } from "~/state/session";

import { BotMascot } from "./BotMascot";
import { BOT_MASCOT_SHAPES, botMascotShape } from "./botMascots";
import { isBotThread } from "./botThreads";
import { useSetBotMascot } from "./useSetBotMascot";

export function BotMascotDetailsSection(props: { readonly threadRef: ScopedThreadRef }) {
  const shell = useQuietThreadShell(props.threadRef);
  const canOperate = useEnvironmentScope(
    props.threadRef.environmentId,
    AuthOrchestrationOperateScope,
  );
  const setBotMascot = useSetBotMascot();
  if (shell === null || !isBotThread(shell)) return null;
  const current = botMascotShape(shell);
  return (
    <ThreadDetailsSection headingId="thread-details-bot-mascot-heading" title="Mascot">
      <div
        role="radiogroup"
        aria-labelledby="thread-details-bot-mascot-heading"
        data-testid="thread-details-bot-mascot"
        className="grid grid-cols-7 gap-1 px-1"
      >
        {BOT_MASCOT_SHAPES.map((shape) => {
          const selected = shape === current;
          return (
            <Tooltip key={shape}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={shape}
                    disabled={!canOperate}
                    onClick={() => {
                      if (!selected) void setBotMascot(shell, shape);
                    }}
                    className={cn(
                      "flex aspect-square min-w-0 cursor-pointer items-center justify-center rounded-lg ring-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-60",
                      selected
                        ? "bg-foreground/10 ring-1 ring-foreground/25"
                        : "hover:bg-foreground/[0.06]",
                    )}
                  />
                }
              >
                <BotMascot shape={shape} mood="Idle" fit={24} />
              </TooltipTrigger>
              <TooltipPopup side="top">{shape}</TooltipPopup>
            </Tooltip>
          );
        })}
      </div>
    </ThreadDetailsSection>
  );
}
