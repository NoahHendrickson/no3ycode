// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=40-191
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/custom/Tabs.tsx
// component=Tabs
import figma from "figma";

const track = figma.selectedInstance;
// The track's size sets its outer height: 28 / 32 / 36px at sm / md / lg.
const size = track.getEnum("Kind", { "Icon md": "md", "Icon lg": "lg", Word: "md" });
const tabs = track
  .findConnectedInstances(() => true)
  .flatMap((tab) => (tab.type === "INSTANCE" ? [tab.executeTemplate()] : []));
const props = (tab: (typeof tabs)[number]) =>
  (tab.metadata?.props ?? {}) as { value?: string; selected?: boolean; imports?: string[] };
const picked = tabs.find((tab) => props(tab).selected) ?? tabs[0];
const pickedValue = picked ? (props(picked).value ?? "tab") : "tab";
// One tab per line: a plain code section between the tabs' own snippets.
const children = tabs.flatMap((tab, index) =>
  index === 0 ? tab.example : [{ type: "CODE" as const, code: "\n  " }, ...tab.example],
);

export default {
  example: figma.tsx`<Tabs aria-label="View"${size ? ` size="${size}"` : ""} defaultValue={["${pickedValue}"]}>
  ${children}
</Tabs>`,
  imports: [
    'import { Tabs } from "~/custom/Tabs";',
    ...new Set(tabs.flatMap((tab) => props(tab).imports ?? [])),
  ],
  id: "tabs",
};
