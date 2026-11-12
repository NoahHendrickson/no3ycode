// @effect-diagnostics nodeBuiltinImport:off
import * as NodeURL from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { mergeConfig, type Plugin } from "vite";

import { forkBrandName } from "../../../scripts/lib/fork-brand-name.ts";
import { forkOverrides } from "../../web/fork/vitePluginForkOverrides.ts";

const webSrc = (path: string) =>
  NodeURL.fileURLToPath(new URL(`../../web/src/${path}`, import.meta.url));

// Tailwind scans for classes from the Vite root, which is apps/web for the app and this package
// here, so index.css gets the app's scan root plus the stories.
function webTailwindSources(): Plugin {
  const indexCss = webSrc("index.css");
  return {
    name: "fork-storybook:web-tailwind-sources",
    enforce: "pre",
    transform(code, id) {
      if (id.split("?")[0] !== indexCss) return;
      return code.replace(
        '@import "tailwindcss";',
        '@import "tailwindcss" source("../");\n@source "../../fork-storybook/stories";',
      );
    },
  };
}

// The slice of apps/web/vite.config.ts that decides how a component resolves and looks:
// the override tree, the brand name, the React Compiler, Tailwind and the icon shim.
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs"],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  viteFinal: (base) =>
    mergeConfig(base, {
      plugins: [
        forkOverrides({ srcDir: webSrc("") }),
        forkBrandName(),
        react({ compiler: true }),
        webTailwindSources(),
        tailwindcss(),
      ],
      resolve: {
        tsconfigPaths: true,
        dedupe: ["react", "react-dom"],
        alias: { "lucide-react": webSrc("custom/icons/lucide-phosphor.tsx") },
      },
    }),
};

export default config;
