import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { ThreadContextRecord, ProjectId } from "@t3tools/contracts";
import { Link, useNavigate } from "@tanstack/react-router";
/* fork:begin fork-sprints — see .fork/customizations.yaml#fork-sprints */
import { useForkThreadHost } from "~/custom/threadLaunchCards/forkThreadHost";
/* fork:end fork-sprints */
import { MessagesSquareIcon } from "lucide-react";
import { useGT } from "gt-react";

import { resolveThreadOpenRoute } from "~/lib/sideChatPane";
import { buildThreadRouteParams } from "~/threadRoutes";
import { useProject, useThreadShell } from "~/state/entities";
import { orchestrationEnvironment } from "~/state/orchestration";
import { useEnvironmentQuery } from "~/state/query";
import { ContextChip, ContextChipLabel } from "./ContextChip";
import { ProjectFavicon } from "./ProjectFavicon";
import { ThreadChipHoverCard } from "./ThreadChipHoverCard";
import { ThreadHoverCardPopup } from "./ThreadHoverCard";
import { Tooltip, TooltipTrigger } from "./ui/tooltip";

export function ThreadContextChip(props: {
  record: Pick<ThreadContextRecord, "environmentId" | "threadId" | "title">;
  projectId?: ProjectId | null;
  copyMarkdown?: string;
  unreadable?: boolean;
  /* fork:begin no3y-subagent-link-chip — see .fork/customizations.yaml#no3y-subagent-link-chip */
  shape?: "capsule" | undefined;
  /* fork:end no3y-subagent-link-chip */
}) {
  const gt = useGT();
  const { environmentId, threadId } = props.record;
  const shell = useThreadShell({ environmentId, threadId });
  const lookup = useEnvironmentQuery(
    shell === null && props.projectId === undefined
      ? orchestrationEnvironment.threadLinkMetadata({
          environmentId,
          input: { threadIds: [threadId] },
        })
      : null,
  );
  const metadata = lookup.data?.[threadId];
  const projectId = shell?.projectId ?? props.projectId ?? metadata?.projectId;
  const project = useProject(projectId ? scopeProjectRef(environmentId, projectId) : null);
  const title = shell?.title?.trim() || metadata?.title.trim() || props.record.title;
  const navigate = useNavigate();
  /* fork:begin fork-sprints — see .fork/customizations.yaml#fork-sprints */
  // The host of the conversation the chip is written in (a sprint), when it has one.
  const forkThreadHost = useForkThreadHost();
  /* fork:end fork-sprints */
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ContextChip
            kind="thread"
            /* fork:begin no3y-subagent-link-chip — see .fork/customizations.yaml#no3y-subagent-link-chip */
            shape={props.shape}
            /* fork:end no3y-subagent-link-chip */
            {...(props.unreadable ? { state: "invalid" as const } : {})}
            render={
              <Link
                to="/$environmentId/$threadId"
                params={{ environmentId, threadId }}
                onClick={(event) => {
                  /* fork:begin fork-sprints — see .fork/customizations.yaml#fork-sprints
                     A thread linked in a sprint's conversation opens in the sprint's panel. */
                  if (
                    event.button === 0 &&
                    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) &&
                    forkThreadHost?.openThread({ environmentId, threadId }) === true
                  ) {
                    event.preventDefault();
                    return;
                  }
                  /* fork:end fork-sprints */
                  if (shell?.lineage.sideChat !== true || event.button !== 0) return;
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  // A side chat opens as a tab beside its parent, not as its own page.
                  event.preventDefault();
                  void navigate({
                    to: "/$environmentId/$threadId",
                    params: buildThreadRouteParams(
                      resolveThreadOpenRoute({ environmentId, threadId }, shell),
                    ),
                  });
                }}
                draggable={false}
              />
            }
            aria-label={gt("Thread, {title}", { title })}
            data-markdown-copy={props.copyMarkdown}
            className="no-underline"
          >
            {project ? (
              <ProjectFavicon project={project} className="size-[1em] self-center" />
            ) : (
              <MessagesSquareIcon />
            )}
            <ContextChipLabel>{title}</ContextChipLabel>
          </ContextChip>
        }
      />
      <ThreadHoverCardPopup side="top">
        <ThreadChipHoverCard
          title={title}
          project={project}
          shell={shell}
          unreadable={props.unreadable === true}
        />
      </ThreadHoverCardPopup>
    </Tooltip>
  );
}
