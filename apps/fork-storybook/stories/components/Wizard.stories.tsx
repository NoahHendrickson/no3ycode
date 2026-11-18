import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfoIcon } from "lucide-react";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Dialog } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  WizardFooter,
  WizardHeader,
  WizardPanel,
  WizardPopup,
  WizardSteps,
} from "~/components/ui/wizard";

import { Stack } from "../Specimen.tsx";

const PUBLISH_STEPS = ["Provider", "Repository", "Summary"] as const;
const PROVIDER_STEPS = ["Provider", "Identity", "Config"] as const;

const meta = {
  title: "Components/Wizard",
  component: WizardSteps,
  tags: ["autodocs"],
  args: {
    steps: PUBLISH_STEPS,
    currentStep: 1,
    summaries: ["GitHub", null, null],
    showSummaries: true,
  },
  argTypes: {
    currentStep: { control: { type: "range", min: 0, max: 2, step: 1 } },
    showSummaries: { control: "boolean" },
  },
  render: (args) => (
    <div className="w-[36rem]">
      <WizardSteps {...args} />
    </div>
  ),
} satisfies Meta<typeof WizardSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const StepProgress: Story = {
  name: "Step progress",
  render: () => (
    <div className="w-[36rem]">
      <Stack gap={3}>
        {PUBLISH_STEPS.map((label, step) => (
          <WizardSteps
            key={label}
            steps={PUBLISH_STEPS}
            currentStep={step}
            summaries={["GitHub", "acme/web-dashboard", null]}
            showSummaries
          />
        ))}
      </Stack>
    </div>
  ),
};

function ClickableSteps() {
  const [step, setStep] = useState(1);
  return (
    <div className="w-[36rem]">
      <WizardSteps
        steps={PROVIDER_STEPS}
        currentStep={step}
        isStepDisabled={(index) => index > step}
        onStepChange={setStep}
      />
    </div>
  );
}

export const Clickable: Story = {
  name: "Clickable steps",
  render: () => <ClickableSteps />,
};

function PublishWizard() {
  const [step, setStep] = useState(1);
  return (
    <Dialog open>
      <WizardPopup>
        <WizardHeader
          title="Publish repository"
          description="Pick where to host it, then point us at a repo to push to."
        >
          <WizardSteps
            steps={PUBLISH_STEPS}
            currentStep={step}
            summaries={["GitHub", null, null]}
            showSummaries
            isStepDisabled={(index) => index > step}
            onStepChange={setStep}
          />
        </WizardHeader>
        <WizardPanel>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="publish-repository-name">Repository name</Label>
              <Input id="publish-repository-name" defaultValue="web-dashboard" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="publish-repository-owner">Owner</Label>
              <Input id="publish-repository-owner" defaultValue="acme" />
            </div>
            <Alert variant="info">
              <InfoIcon aria-hidden />
              <AlertDescription>
                The repository is created private. Change it on GitHub later.
              </AlertDescription>
            </Alert>
          </div>
        </WizardPanel>
        <WizardFooter
          leading={
            <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))}>
              Back
            </Button>
          }
        >
          <Button variant="outline">Cancel</Button>
          <Button onClick={() => setStep(Math.min(2, step + 1))}>Continue</Button>
        </WizardFooter>
      </WizardPopup>
    </Dialog>
  );
}

export const Open: Story = {
  name: "Open (dialog)",
  render: () => <PublishWizard />,
};

export const OpenWide: Story = {
  name: "Open, wide",
  render: () => (
    <Dialog open>
      <WizardPopup size="wide">
        <WizardHeader
          title="Add ChatGPT account"
          description="Each account has its own Codex instance and sign-in. Choose the other account on the sign-in page."
        />
        <WizardPanel>
          <div className="grid gap-1.5">
            <Label htmlFor="add-codex-account-name">Account name</Label>
            <Input id="add-codex-account-name" placeholder="e.g. Personal or Work" />
          </div>
        </WizardPanel>
        <WizardFooter>
          <Button variant="outline">Cancel</Button>
          <Button disabled>Add account</Button>
        </WizardFooter>
      </WizardPopup>
    </Dialog>
  ),
};
