import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import { ToastProvider, toastManager } from "~/components/ui/toast";

type ToastOptions = Parameters<typeof toastManager.add>[0];

// The toast manager is module-level, so each story adds its toasts on mount and closes them on
// unmount; otherwise they would carry over into the next story.
function Toasts({ toasts }: { toasts: ReadonlyArray<ToastOptions> }) {
  useEffect(() => {
    const ids = toasts.map((toast) => toastManager.add({ timeout: 0, ...toast }));
    return () => {
      for (const id of ids) toastManager.close(id);
    };
  }, [toasts]);
  return null;
}

function ToastStory({ toasts }: { toasts: ReadonlyArray<ToastOptions> }) {
  return (
    <ToastProvider>
      <Toasts toasts={toasts} />
    </ToastProvider>
  );
}

const meta = {
  title: "Components/Toast",
  parameters: { router: true, surface: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const one = (toast: ToastOptions): Story => ({ render: () => <ToastStory toasts={[toast]} /> });

export const Playground: Story = {
  render: () => (
    <ToastProvider>
      <div className="flex flex-wrap gap-2">
        {(["success", "error", "warning", "info", "loading"] as const).map((type) => (
          <Button
            key={type}
            variant="outline"
            onClick={() =>
              toastManager.add({
                type,
                title: `A ${type} toast`,
                description: "Toasts stack in the top-right corner.",
              })
            }
          >
            {type}
          </Button>
        ))}
      </div>
    </ToastProvider>
  ),
};

export const Success = one({
  type: "success",
  title: "Branch pushed",
  description: "t3/basic is up to date with origin.",
});

export const ErrorToast: Story = {
  name: "Error",
  ...one({
    type: "error",
    title: "The environment is not connected.",
    description: "Reconnect from Settings › Connections and try again.",
  }),
};

export const Warning = one({
  type: "warning",
  title: "The composer is not ready",
  description: "Try replying after the connection or pending input is resolved.",
});

export const Info = one({
  type: "info",
  title: "Update available",
  description: "Restart to install no3y code 0.4.2.",
});

export const Loading = one({ type: "loading", title: "Creating worktree…" });

export const TitleOnly = one({ type: "success", title: "Copied to clipboard" });

export const WithAction = one({
  type: "info",
  title: "Thread archived",
  description: "It moved out of the sidebar.",
  actionProps: { children: "Undo" },
});

export const LongError = one({
  type: "error",
  title: "Checkpoint failed",
  description:
    "git exited with code 128: fatal: Unable to create '/Users/dev/project/.git/index.lock': File exists. Another git process seems to be running in this repository, e.g. an editor opened by 'git commit'. Please make sure all processes are terminated then try again.",
});

export const Stack: Story = {
  render: () => (
    <ToastStory
      toasts={[
        { type: "success", title: "Branch pushed" },
        { type: "info", title: "Update available", description: "Restart to install." },
        { type: "warning", title: "The composer is not ready" },
      ]}
    />
  ),
};
