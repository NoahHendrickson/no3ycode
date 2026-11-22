// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=56-429
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/chat/ChatComposer.tsx
// component=ChatComposer
import figma from "figma";

// ChatView.tsx renders the one composer for a thread and for a new agent's draft; its text,
// project, branch, model and effort all come from the draft and thread state it is handed.
export default {
  example: figma.tsx`<ChatComposer
  composerRef={composerRef}
  composerDraftTarget={composerDraftTarget}
  environmentId={environmentId}
  routeKind={routeKind}
  activeThread={activeThread}
  phase={phase}
  /* …and ChatView's capability, send and handler props */
/>`,
  imports: ['import { ChatComposer } from "~/components/chat/ChatComposer";'],
  id: "composer",
};
