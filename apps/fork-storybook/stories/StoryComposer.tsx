import type { ReactNode } from "react";

import { ComposerBanner } from "~/components/chat/ComposerBanner";
import { ComposerSurface } from "~/components/chat/ComposerSurface";
import { ComposerPromptRow, ComposerShell } from "~/custom/ComposerShell";

/** The composer's vessel at rest (nothing pending, desktop), holding only the controls a story
    passes. It sits in ChatView's overlay and ChatComposer's form, as in the app, so the rules
    scoped to the thread composer (Flat Glass's among them) reach it. */
export function StoryComposer(props: {
  context?: ReactNode;
  modeControls?: ReactNode;
  usageControls?: ReactNode;
  topVessel?: ReactNode;
  statusChips?: ReactNode;
  /** Cards above the composer, in ChatComposer's banner dock: notices, the queue, a question. */
  banners?: ReactNode;
  /** The prompt surface with this placeholder standing in for the editor; none without it. */
  prompt?: string;
}) {
  return (
    <div data-chat-composer-overlay="true" className="pt-1.5 sm:pt-2">
      <div className="chat-composer-lane w-full">
        <div
          data-chat-composer-stack="true"
          data-fork-composer-stack="true"
          className="group/composer-stack relative z-10 mx-auto w-full max-w-(--chat-content-max-width)"
        >
          <form
            data-chat-composer-form="true"
            className="mx-auto w-full min-w-0 max-w-(--chat-content-max-width)"
            onSubmit={(event) => event.preventDefault()}
          >
            <ComposerShell
              approvalPending={false}
              context={props.context}
              collapsedMobile={false}
              mobilePendingActionsVisible={false}
              modelControls={null}
              readoutControls={null}
              modeControls={props.modeControls ?? null}
              usageControls={props.usageControls}
              topVessel={props.topVessel}
              statusChips={props.statusChips}
              banners={
                <ComposerBanner.Dock>
                  <ComposerBanner.Column>{props.banners}</ComposerBanner.Column>
                </ComposerBanner.Dock>
              }
            >
              {props.prompt === undefined ? null : <StoryPrompt placeholder={props.prompt} />}
            </ComposerShell>
          </form>
        </div>
      </div>
    </div>
  );
}

/** ChatComposer's prompt surface, its editor replaced by the placeholder line. */
function StoryPrompt({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative">
      <ComposerSurface.Main data-inline-resting-controls="true" data-fork-composer-box="true">
        <div
          data-fork-composer-surface="true"
          data-chat-composer-surface="true"
          data-chat-composer-mobile-collapsed="false"
          className="rounded-2xl"
        >
          <div data-chat-composer-body="true" className="relative px-2 py-2.5">
            <div className="relative">
              <ComposerPromptRow
                action={null}
                approvalPending={false}
                mobilePendingActionsVisible={false}
              >
                <p className="min-h-6 px-1 text-sm/6 text-placeholder">{placeholder}</p>
              </ComposerPromptRow>
            </div>
          </div>
        </div>
      </ComposerSurface.Main>
    </div>
  );
}
