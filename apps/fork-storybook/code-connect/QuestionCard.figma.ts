// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=321-626
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/chat/ComposerPendingUserInputPanel.tsx
// component=ComposerPendingUserInputPanel
import figma from "figma";

// The question card's body; ChatComposer mounts it in its top drawer and owns the answers.
export default {
  example: figma.tsx`<ComposerPendingUserInputPanel
  pendingUserInputs={pendingUserInputs}
  cwd={cwd}
  threadRef={threadRef}
  disabled={${figma.selectedInstance.getEnum("State", { Disabled: "true" }) ?? "false"}}
  respondingRequestIds={respondingRequestIds}
  answers={answers}
  questionIndex={questionIndex}
  onToggleOption={onToggleOption}
  onAdvance={onAdvance}
  onPrevious={onPrevious}
  onDismiss={onDismiss}
/>`,
  imports: [
    'import { ComposerPendingUserInputPanel } from "~/components/chat/ComposerPendingUserInputPanel";',
  ],
  id: "question-card",
};
