/**
 * The fork's design-system lint rules — see `.fork/DESIGN-RULES.md`.
 *
 * The per-file TSX half runs in oxlint: the root vite.config.ts appends DESIGN_LINT_OVERRIDES.
 * The CSS and cross-file half is `.fork/design-lint.mjs`.
 */

/** Fork-owned TSX: new modules and the upstream modules the fork shadows. */
export const DESIGN_LINT_TSX_SCOPE = ["apps/web/src/custom/**", "apps/web/src/overrides/**"];

/**
 * Overrides are upstream modules, so the rules about what fork code builds by hand stay on
 * custom/ only; the shadcn rules are upstream's own and hold for both.
 */
export const DESIGN_LINT_CUSTOM_ONLY_SCOPE = ["apps/web/src/custom/**"];

const NOT_IN_TESTS = [
  "**/*.{test,spec,bench}.{ts,tsx}",
  "**/*.browser.test.{ts,tsx}",
  // Vendored from NoahHendrickson/the-forge; kept verbatim for re-syncs.
  "apps/web/src/custom/designMode/engine/vendor/**",
];

/**
 * A5's allowlist on top of upstream's (vite.config.ts): kinds of value no token can express. A
 * value only one component uses is not a kind: it takes a reasoned line suppression at its site.
 */
export const DESIGN_ARBITRARY_VALUE_ALLOW = [
  // Upstream also allows "layout", which waves through h-[26px] and w-[13px]; A5 does not.
  "transition",
  // Upstream's own: em insets that keep inline chips on the text's own scale.
  "rounded-[inherit]",
  "gap-[0.33em]",
  "gap-[0.2em]",
  "leading-[normal]",
  "underline-offset-[0.2em]",
  "rounded-[25%]",
  "text-[length:80cqh]",
  "bg-[Highlight]",
  // Properties Tailwind has no utility for, set to a keyword: there is no value to tokenise.
  "[-webkit-app-region:no-drag]",
  "[scrollbar-width:none]",
  "[scrollbar-width:thin]",
  "[content-visibility:auto]",
  "[image-rendering:pixelated]",
  "[text-box:trim-both_cap_alphabetic]",
  // Grid tracks made only of fr, auto and minmax(0, …): proportions, not sizes.
  "grid-cols-[auto_minmax(0,1fr)]",
  "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
  "grid-cols-[1fr_1fr_auto]",
  "grid-cols-[1fr_auto_1fr]",
  // Viewport, container and anchor clamps: the vw/vh/%/anchor term is the point.
  "max-h-[60vh]",
  "h-[min(20rem,30vh)]",
  "w-[min(32rem,calc(100vw-2rem))]",
  "w-[min(24rem,calc(100vw-2rem))]",
  "max-w-[min(22rem,calc(100vw-2rem))]",
  "max-w-[calc(100vw-3rem)]",
  "max-h-[min(28rem,calc(var(--available-height)-1rem))]",
  "min-w-[min(100%,11rem)]",
  // Built only from tokens (and a hairline): a fill sized by the --fill the component sets, the
  // titlebar controls' inset, a 1px rim in --color-border, a parent's radius less its inset.
  "[background:linear-gradient(var(--muted-foreground),var(--muted-foreground))_0_0/var(--fill)_100%_no-repeat,var(--border)]",
  "pl-[calc(var(--workspace-controls-left)+var(--workspace-titlebar-control-size)+var(--workspace-titlebar-control-gap))]",
  "shadow-[inset_0_1px_0_var(--color-border)]",
  "rounded-[calc(var(--radius-sm)-2px)]",
  // A fork keyframes name with its timing: Tailwind has no utility for a fork keyframe.
  "animate-[sidebar-v2-film_linear_infinite]",
];

/**
 * Exceptions that are not a line comment: a whole selector or file the rule does not fit.
 * `match` is a substring of the selector (or of the component name for B5); a B5 `name` must match
 * the component exactly. Each needs a reason. design-lint.mjs reads these.
 */
export const DESIGN_LINT_ALLOWLIST = [
  // { rule: "A1", file: "apps/web/src/theme.custom.css", match: ".fork-wordmark", reason: "…" },
  ...b5Exempt("route page", {
    "scheduled/ScheduledPage.tsx": ["ScheduledPage"],
    "scheduled/ScheduledTaskDetail.tsx": ["ScheduledTaskDetail"],
    "scheduled/ScheduledTaskEditor.tsx": ["ScheduledTaskEditor"],
  }),
  ...b5Exempt("page layout: lays out one screen or panel", {
    "DraftLaunchpad.tsx": ["DraftLaunchpad"],
    "sideChat/SideChatShell.tsx": ["SideChatShell"],
    "splitThreads/SplitThreadPanes.tsx": ["SplitThreadPanes"],
    "bots/BotThreadsPanel.tsx": [
      "BotThreadsPanel",
      "BotThreadsPanelFrame",
      "BotThreadsHeader",
      "BotThreadsSearchInput",
      "BotThreadsListControls",
      "BotThreadsCloseButton",
      "BotThreadsListBody",
      "BotThreadsList",
    ],
    "sprints/SprintPanel.tsx": ["SprintPanel"],
    "sprints/SidebarV2SprintsSection.tsx": ["NewSprintDialog"],
    "coordinator/CoordinatorPanel.tsx": ["CoordinatorPanel"],
    "designMode/panel/ForkDesignPanel.tsx": ["ForkDesignPanel"],
    "designMode/ForkLayersTree.tsx": ["ForkLayersTree"],
  }),
  ...b5Exempt("section: lays out storied atoms for one region of one screen", {
    "SidebarV2ChromeRows.tsx": ["SidebarV2ChromeActionRows", "SidebarV2ChatActionRows"],
    "CollapsedThreadTabs.tsx": ["CollapsedThreadTabs"],
    "bots/CollapsedPetalTabs.tsx": ["CollapsedPetalTabs"],
    "bots/SidebarV2BotsSection.tsx": ["SidebarV2BotsRow"],
    "bots/BotMascotDetailsSection.tsx": ["BotMascotDetailsSection"],
    "sprints/SidebarV2SprintsSection.tsx": ["SidebarV2SprintsRow"],
    "coordinator/SidebarV2CoordinatorsSection.tsx": ["SidebarV2CoordinatorsRow"],
    "SidebarV2ListSection.tsx": ["SidebarV2ListSection"],
    "sprints/SprintGoal.tsx": ["SprintGoal"],
    "sprints/SprintThreadModel.tsx": ["SprintThreadModel"],
    "sprints/SprintContext.tsx": ["SprintContext"],
    "threadLaunchCards/ForkThreadLaunchCards.tsx": [
      "ForkThreadLaunchList",
      "ForkWorkReportRow",
      "ForkThreadHookRow",
    ],
    "threadLaunchCards/ForkThreadRequestCard.tsx": [
      "ForkThreadRequestCard",
      "ForkAnsweredRequestCard",
    ],
    "sprints/SprintPanelTabs.tsx": ["SprintPanelTabStrip", "SprintPanelTabContent"],
    "sprints/SprintFileEditor.tsx": ["SprintFileEditor", "SprintFileFooter", "NoSprintFileAccess"],
    "bots/BotThreadsChild.tsx": [
      "BotThreadsChildHeading",
      "BotThreadsChildConversation",
      "BotThreadsChildPanelBody",
    ],
    "sprints/SprintPullRequests.tsx": ["SprintPullRequests"],
    "sprints/SprintEmptyConversation.tsx": ["SprintEmptyConversation"],
    "bots/BotDigest.tsx": ["BotDigestAsks"],
    "scheduled/ScheduledRunsTable.tsx": ["ScheduledRunsHeader", "ScheduledRunRows"],
    "designMode/panel/SentPreviewResolution.tsx": ["SentPreviewResolution"],
    "designMode/panel/sections/AppearanceSection.tsx": ["AppearanceSection"],
    "designMode/panel/sections/LayoutSection.tsx": ["LayoutSection"],
    "designMode/panel/sections/PaintSections.tsx": [
      "FillSection",
      "StrokeSection",
      "MarginSection",
    ],
    "designMode/panel/sections/PositionSection.tsx": ["PositionSection"],
    "designMode/panel/sections/TypographySection.tsx": ["TypographySection"],
    "designMode/panel/sections/section.tsx": ["SideFields"],
  }),
  ...b5Exempt("provider/host: draws no UI of its own", {
    "ForkSubagentLinkChip.tsx": ["ForkSubagentLinkScope"],
    "forkTimelineRowMotion.tsx": ["ForkTimelineRowFrame"],
    "voice/ForkDictationHotkeyHost.tsx": ["ForkDictationHotkeyHost"],
    "designMode/ForkPreviewDesignMode.tsx": ["ForkPreviewDesignMode"],
    // Renders whatever the picker's host passes for a model row.
    "modelRowControl.tsx": ["RowControlSlot"],
  }),
  ...b5Exempt("screen backdrop: full-bleed art behind a screen", {
    "BasicNewAgentBackdrop.tsx": ["BasicNewAgentBackdrop"],
    "pixelTexture/PixelTextureBackdrop.tsx": ["PixelTextureBackdrop"],
  }),
  ...b5Exempt("wrapper: the unstyled base under Tabs and MenuTabs (Components/Tabs)", {
    "SegmentedTabs.tsx": ["SegmentedTabs", "SegmentedTab", "SegmentedMenuTabs", "SegmentedMenuTab"],
  }),
  ...b5Exempt("wrapper: reads live thread state, then draws a storied view", {
    // BotThreadsCompactRowView, Fork/Petal work row › Compact.
    "bots/BotThreadsCompactRow.tsx": ["BotThreadsCompactRow"],
    // ForkSubagentStartLineView, Fork/Subagent line.
    "ForkSubagentGroup.tsx": ["ForkSubagentGroup", "ForkSubagentNotice"],
    // SubagentLinkMark in a ContextChip, Fork/Subagent link.
    "ForkSubagentLinkChip.tsx": ["ForkSubagentLinkChip"],
    // BotMascot, Fork/Petal mascot.
    "bots/BotMascot.tsx": ["BotEmptyConversation", "BotHeaderMascot"],
    // SidebarProviderUpdatesButtonView.
    "SidebarProviderUpdatesButton.tsx": ["SidebarProviderUpdatesButton"],
    // MusicStripCardView, Fork/Music strip.
    "music/MusicStrip.tsx": ["SidebarMusicStrip"],
    // SidebarV2AutomationsHoverCardView and SidebarV2AutomationsRunView, Fork/Automations hover card.
    "SidebarV2AutomationsHoverCard.tsx": ["SidebarV2AutomationsHoverCard"],
    // ComposerPendingUserInputPanel and forkApprovalNoticeItem, Fork/Petal digest › Work thread requests.
    "bots/BotChildRequests.tsx": ["BotChildQuestion", "BotChildApproval"],
  }),
  ...b5Exempt("frame of storied cards: draws only the slots its callers fill", {
    // The Questions card's frame, Fork/Composer cards › Question card and Fork/Petal digest.
    "ForkQuestionCard.tsx": ["ForkQuestionCard"],
    // The banner every digest card draws in, Fork/Petal digest.
    "bots/BotDigestBottom.tsx": ["BotDigestBanner"],
  }),
  ...b5Exempt("part of a storied card, drawn only inside it", {
    // The Questions card's option row, Fork/Composer cards › Question card and Fork/Petal digest.
    "ForkQuestionOption.tsx": ["ForkQuestionOption"],
    // BotDigestBottom's and the status line's button, Fork/Petal digest › Dismissed hidden.
    "bots/BotDigestBottom.tsx": ["BotDigestShowDismissed"],
  }),
  ...b5Exempt("wrapper: the sidebar chrome's look on a primitive (Fork/Sidebar controls)", {
    "SidebarChromeButton.tsx": ["SidebarChromeGroup", "SidebarChromeRadioItem"],
  }),
  ...b5Exempt("wrapper around CheckboxPill (Fork/Checkbox pill)", {
    "coordinator/CoordinatorDraftToggle.tsx": ["CoordinatorDraftToggle"],
  }),
  ...b5Exempt("wrapper around ComposerModelPicker", {
    "scheduled/ScheduledTaskModelPicker.tsx": ["ScheduledTaskModelPicker"],
    "sprints/SprintModelPicker.tsx": ["SprintModelPicker"],
  }),
  ...b5Exempt("wrapper around upstream's ThreadHoverCardPopup, which places it", {
    "SubagentRowHoverCardPopup.tsx": ["SubagentRowHoverCardPopup"],
  }),
  ...b5Exempt("wrapper around an upstream control that reads live state itself", {
    "ComposerModelPicker.tsx": ["ComposerModelPicker"],
    "DraftMachineChip.tsx": ["DraftMachineChip"],
  }),
];

/** B5 entries for components that are not atomic: one per name, which must match exactly. */
function b5Exempt(reason, byFile) {
  return Object.entries(byFile).flatMap(([file, names]) =>
    names.map((name) => ({ rule: "B5", file: `apps/web/src/custom/${file}`, name, reason })),
  );
}

/** Custom properties another library or the browser sets at runtime, so C3 cannot see them. */
export const RUNTIME_TOKEN_PREFIXES = [
  "--tw-", // Tailwind's per-utility plumbing
  // Base UI stamps these on positioners and popups as inline styles.
  "--anchor-",
  "--available-",
  "--transform-origin",
  "--popup-",
  "--positioner-",
  "--collapsible-",
  "--accordion-",
  "--active-tab-",
  "--scroll-area-",
  "--toast-",
  "--nested-dialogs",
];

/** The overrides vite.config.ts appends to `lint.overrides`, after the block that turns shadcn off. */
export const DESIGN_LINT_OVERRIDES = [
  {
    files: DESIGN_LINT_TSX_SCOPE,
    excludeFiles: NOT_IN_TESTS,
    rules: {
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": ["error", { allow: DESIGN_ARBITRARY_VALUE_ALLOW }],
      "shadcn/no-restyle": [
        "error",
        {
          allow: ["layout"],
          contracts: [
            {
              // CollapsibleTrigger has no styled counterpart; other triggers use render={<Button …/>}.
              pattern: "^CollapsibleTrigger$",
              allow: ["layout", "color", "typography", "spacing", "shape", "effects", "motion"],
            },
          ],
        },
      ],
    },
  },
  {
    files: DESIGN_LINT_CUSTOM_ONLY_SCOPE,
    excludeFiles: NOT_IN_TESTS,
    rules: {
      "t3code/no-hand-built-primitives": "error",
      "t3code/no-hand-built-status-marks": "error",
      "t3code/no-direct-icon-imports": "error",
    },
  },
  {
    // The shim itself, and the one module that draws status marks.
    files: ["apps/web/src/custom/icons/**"],
    rules: { "t3code/no-direct-icon-imports": "off", "t3code/no-hand-built-status-marks": "off" },
  },
  {
    files: ["apps/web/src/custom/SidebarV2StatusIndicator.tsx"],
    rules: { "t3code/no-hand-built-status-marks": "off" },
  },
];
