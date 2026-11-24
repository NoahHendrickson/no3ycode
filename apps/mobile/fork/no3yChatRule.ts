/** Which threads are chats on no3y iOS — see `.fork/customizations.yaml#no3y-mobile-redesign`. */
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

export const NO3Y_CHAT_THREAD_TAG = "chat";

/**
 * The Mac's chat rule (apps/web/src/custom/chatMode.ts isChatThread): tagged `chat`, or sent from
 * this phone as a chat and still waiting for its tag (fork/no3yChatTagging.ts). A thread in the
 * No-project workspace without the tag is code, as it is on the Mac.
 */
export function isNo3yChatThread(
  thread: Pick<EnvironmentThreadShell, "environmentId" | "id" | "source">,
  sentChatKeys?: ReadonlySet<string>,
): boolean {
  if (thread.source.tags?.includes(NO3Y_CHAT_THREAD_TAG) === true) return true;
  return (
    sentChatKeys?.has(scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))) === true
  );
}
