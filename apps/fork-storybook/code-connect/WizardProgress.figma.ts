// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=65-164
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/wizard.tsx
// component=WizardSteps
import figma from "figma";

// Each step's label and the current one come from the wizard (GitActionsControl.tsx publishes
// through one); the kit's steps are a sample.

export default {
  example: figma.tsx`<WizardSteps
  steps={publishWizardSteps}
  currentStep={publishWizardStep}
  summaries={publishWizardStepSummaries}
/>`,
  imports: ['import { WizardSteps } from "~/components/ui/wizard";'],
  id: "wizard-progress",
};
