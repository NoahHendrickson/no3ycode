/**
 * A Petal's work threads' questions and approvals as the thread's own cards — see
 * `.fork/customizations.yaml#fork-bot-digest`. They answer through childRequestControls, as a
 * sprint's inline cards do.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import { ComposerBannerStack } from "~/components/chat/ComposerBannerStack";
import { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";

import { useChildApproval, useChildQuestion } from "../childRequestControls";
import { ForkQuestionCard } from "../ForkQuestionCard";
import {
  BotDigestBanner,
  BotDigestBottom,
  BotDigestBottomInline,
  type BotDigestBottomState,
} from "./BotDigestBottom";
import { childLinks } from "./BotDigestItem";

/** The thread's card without its request: while it loads (or the shell's flag runs ahead of it),
    so the card the pager is on never vanishes, or when only the thread can answer it. */
function ChildNote(props: {
  readonly child: EnvironmentThreadShell;
  readonly bottom: BotDigestBottomState;
  readonly note: string;
}) {
  const { child } = props;
  return (
    <BotDigestBanner>
      <ForkQuestionCard
        question={<p className="text-muted-foreground">{props.note}</p>}
        footer={
          <BotDigestBottom
            {...props.bottom}
            links={childLinks(child)}
            environmentId={child.environmentId}
          />
        }
      />
    </BotDigestBanner>
  );
}

/** @public — a work thread's question as its Questions card. */
export function BotChildQuestion(props: {
  readonly child: EnvironmentThreadShell;
  readonly bottom: BotDigestBottomState;
}) {
  const { child } = props;
  const question = useChildQuestion(child);
  if (question === null) {
    return (
      <ChildNote child={child} bottom={props.bottom} note={`${child.title} is waiting on you.`} />
    );
  }
  // Typed words are the thread composer's; this one talks to the Petal.
  if (question.input.questions.some((entry) => entry.options.length === 0)) {
    return (
      <ChildNote
        child={child}
        bottom={props.bottom}
        note="This question needs a typed answer. Open the thread to answer it."
      />
    );
  }
  return (
    <BotDigestBanner>
      <ComposerPendingUserInputPanel
        {...question.panel}
        footer={
          <BotDigestBottom
            {...props.bottom}
            links={childLinks(child)}
            environmentId={child.environmentId}
          />
        }
      />
    </BotDigestBanner>
  );
}

/** @public — a work thread's approval as its approval notice. */
export function BotChildApproval(props: {
  readonly child: EnvironmentThreadShell;
  readonly bottom: BotDigestBottomState;
}) {
  const { child } = props;
  const approval = useChildApproval(child);
  if (approval === null) {
    return (
      <ChildNote child={child} bottom={props.bottom} note={`${child.title} is waiting on you.`} />
    );
  }
  return (
    <ComposerBannerStack
      items={[
        approval.notice(
          <BotDigestBottomInline
            {...props.bottom}
            links={childLinks(child)}
            environmentId={child.environmentId}
          />,
        ),
      ]}
    />
  );
}
