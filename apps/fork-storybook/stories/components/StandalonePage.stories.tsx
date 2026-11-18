import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { StandalonePage, StandalonePageHeader } from "~/components/ui/standalone-page";

// The page fills its parent's height, as it fills the app root; the frame stands in for the window.
function Window({ children }: { children: ReactNode }) {
  return <div className="h-[44rem] overflow-hidden rounded-xl border">{children}</div>;
}

const meta = {
  title: "Components/Standalone Page",
  component: StandalonePageHeader,
  tags: ["autodocs"],
  parameters: { surface: "bare" },
  args: {
    title: "Pairing with this environment",
    description: "Validating the pairing link and preparing your session.",
  },
  argTypes: {
    context: { control: "text" },
  },
  render: (args) => (
    <Window>
      <StandalonePage>
        <StandalonePageHeader {...args} />
      </StandalonePage>
    </Window>
  ),
} satisfies Meta<typeof StandalonePageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const PairingForm: Story = {
  name: "Pairing form",
  render: () => (
    <Window>
      <StandalonePage>
        <StandalonePageHeader
          title="Pair with this environment"
          description="Paste the pairing token shown by the host, or open its pairing link on this device."
        />
        <form className="mt-6 space-y-4" onSubmit={(event) => event.preventDefault()}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="pairing-token">
              Pairing token
            </label>
            <Input
              id="pairing-token"
              nativeInput
              placeholder="Paste a one-time token or pairing secret"
              spellCheck={false}
            />
          </div>
          <Alert variant="error">
            <AlertDescription>
              This pairing token has expired. Ask the host for a new one.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit">
              Continue
            </Button>
          </div>
        </form>
      </StandalonePage>
    </Window>
  ),
};

export const WithContext: Story = {
  name: "With context",
  render: () => (
    <Window>
      <StandalonePage>
        <StandalonePageHeader
          context="Agent sign-in"
          title="Sign in to approve"
          description="Sign in to T3 Connect with the account this environment is linked to."
        />
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button">Sign in</Button>
          <Button size="sm" variant="link">
            Use a sign-in code instead
          </Button>
        </div>
      </StandalonePage>
    </Window>
  ),
};
