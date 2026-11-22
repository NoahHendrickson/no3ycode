/**
 * What the Chat screen swaps into the New agent draft it hosts: its header, the chat list in
 * place of the hero, and where a sent chat goes — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Null everywhere else.
 */
import { createContext, use, type ReactNode } from "react";

export interface No3yChatDraftSurface {
  readonly header: ReactNode;
  readonly content: (headerInset: number, bottomInset: number) => ReactNode;
  readonly onSubmitted: (environmentId: string, threadId: string) => void;
}

export const No3yChatDraftContext = createContext<No3yChatDraftSurface | null>(null);

export function useNo3yChatDraftSurface(): No3yChatDraftSurface | null {
  return use(No3yChatDraftContext);
}
