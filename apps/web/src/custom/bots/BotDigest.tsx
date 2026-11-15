/**
 * A bot's digest at the top of its Threads panel — see `.fork/customizations.yaml#fork-bot-digest`.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ProjectReadFileResult } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";

import { cn } from "~/lib/utils";
import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";

import { SidebarV2SectionLabel } from "../SidebarV2SectionLabel";
import { parseBotDigest } from "./botDigestSections";
import { BOT_DIGEST_FILE } from "./botSeedFiles";

const NO_DIGEST = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("bot-digest:none"),
);

/** The digest's sections with something in them; nothing while it is empty or unreadable. */
export function BotDigest(props: {
  readonly bot: Pick<EnvironmentThreadShell, "environmentId" | "worktreePath" | "latestRun">;
}) {
  const { bot } = props;
  const { canReadFiles } = useFilesystemReadAccess(bot.environmentId);
  const query =
    canReadFiles && bot.worktreePath !== null
      ? projectEnvironment.readFile({
          environmentId: bot.environmentId,
          input: { cwd: bot.worktreePath, relativePath: BOT_DIGEST_FILE, allowMissing: true },
        })
      : NO_DIGEST;
  // The bot rewrites its digest during a turn, so each run it starts or ends reads it again.
  const revision = bot.latestRun === null ? null : `${bot.latestRun.runId}:${bot.latestRun.status}`;
  const result = useAtomValue(revisionedQuery(query, canReadFiles ? revision : undefined));
  const file = AsyncResult.getOrElse(result, () => null);
  const sections = file === null || file.exists === false ? [] : parseBotDigest(file.contents);
  if (sections.length === 0) return null;
  return (
    <div className="border-b border-border px-3.5 pt-1 pb-3" data-fork-bot-digest="">
      {sections.map((section) => (
        <section key={section.title} className="pt-2">
          <div className="flex h-7 items-center">
            <SidebarV2SectionLabel
              count={section.items.length}
              testId={`bot-digest-${section.title.toLowerCase().replace(/\W+/g, "-")}`}
            >
              {section.title}
            </SidebarV2SectionLabel>
          </div>
          <ul className="flex flex-col gap-1">
            {section.items.map((item) => (
              <li
                key={item}
                className={cn(
                  "text-sm leading-5 break-words",
                  section.needsYou ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
