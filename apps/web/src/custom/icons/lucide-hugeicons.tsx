/**
 * fork: lucide-react -> Hugeicons (free, Stroke Rounded).
 *
 * `lucide-react` is aliased to this module in `apps/web/vite.config.ts` and
 * `apps/web/tsconfig.json`, so every upstream import site keeps saying
 * `from "lucide-react"` and renders Hugeicons instead: one additive file plus
 * two low-churn config edits, not a rewrite of every hot component.
 *
 * Each row names its policy: `stroke` never fills, `themed` fills under the
 * fork palettes (forkPaletteFillsIcons), `fill` always fills. The free set
 * ships outlines only, so the fill is derived (hugeiconsFill.ts); a guard
 * checks that every `themed` and `fill` row can actually fill. A caller can pin
 * a glyph with `weight="stroke"` or `weight="fill"`.
 *
 * Adding an icon: if an upstream sync introduces a lucide import this module
 * does not export, the build fails naming that icon. Add a line to the table.
 *
 * Bundle cost, measured on the production web build (2026-11-18), Phosphor at
 * a8e56e60c9 against this table: the icon chunk went from 705,152 raw /
 * 152,733 gzip to 246,537 / 63,744, and all JS from 38,785,393 / 10,295,799
 * to 38,294,461 / 10,202,296. The namespace import tree-shakes (one module per
 * glyph, sideEffects: false). Re-measure if the icon count moves materially.
 *
 * See .fork/customizations.yaml#phosphor-duotone-icons (the id predates the
 * Hugeicons swap).
 */
import * as Hg from "@hugeicons/core-free-icons";
import type { FC, ReactElement, SVGProps } from "react";
import { createElement, useId } from "react";

import { forkPaletteFillsIcons, useActiveForkPalette } from "../forkActivePalette";
import { GLYPH_STROKE, glyphDrawing, type IconSvgElement } from "./hugeiconsFill";

/** `stroke` never fills, `themed` fills under the fork palettes, `fill` always fills. */
type FillPolicy = "stroke" | "themed" | "fill";

/** A caller pins a glyph to its outline or its fill. */
export type IconWeight = "stroke" | "fill";

/**
 * Upstream assigns lucide icons into slots typed `React.FC<SVGProps<SVGSVGElement>>`
 * (see `~/components/Icons.tsx`), so the props stay assignable from plain SVG props under
 * `exactOptionalPropertyTypes`.
 */
type LucideCompatProps = SVGProps<SVGSVGElement> & {
  alt?: string | undefined;
  size?: string | number | undefined;
  weight?: IconWeight | undefined;
};

/**
 * Upstream writes `React.ComponentProps<typeof SomeIcon>` and annotates icon
 * slots as `LucideIcon`, so both names have to keep resolving.
 */
export type LucideIcon = FC<LucideCompatProps>;
export type LucideProps = LucideCompatProps;

/**
 * lucide's `icons` record, left empty. Only upstream's
 * `lib/lucideIconByName.ts` reads it, and the fork shadows that module with a
 * lookup over this shim's `*Icon` exports, so this only keeps upstream's import
 * type-correct.
 */
export const icons: Record<string, LucideIcon> = {};

/** lucide also stamps the name re-kebabed from PascalCase, which glues a
 *  trailing digit on ("mouse-pointer-2" → "lucide-mouse-pointer2"). */
function withPascalKebabClass(classes: string, lucideName: string): string {
  const pascalKebab = lucideName.replace(/-(\d)/g, "$1");
  return pascalKebab === lucideName ? classes : `${classes} lucide-${pascalKebab}`;
}

const draw = ([tag, attrs]: IconSvgElement[number]): ReactElement => createElement(tag, attrs);

/** One Hugeicons glyph, stroked or filled. The stroke is set on the <svg>, so a caller's
    stroke props reach every part. */
export function HugeGlyph({
  data,
  filled,
  size,
  alt,
  ...props
}: Omit<LucideCompatProps, "weight"> & { data: IconSvgElement; filled: boolean }) {
  const maskId = `fork-icon-${useId().replace(/[^\w-]/g, "")}`;
  const { bodies, knockouts, plain } = glyphDrawing(data, filled);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size ?? "1em"}
      height={size ?? "1em"}
      viewBox="0 0 24 24"
      fill="none"
      {...GLYPH_STROKE}
      {...props}
    >
      {alt ? <title>{alt}</title> : null}
      {knockouts.length > 0 ? (
        <>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
              <rect width="24" height="24" fill="white" stroke="none" />
              {knockouts.map(draw)}
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>{bodies.map(draw)}</g>
        </>
      ) : (
        bodies.map(draw)
      )}
      {plain.map(draw)}
    </svg>
  );
}

/**
 * One table row: the glyph under lucide's name and the row's fill policy, which a caller's
 * `weight` overrides. `lucideName` reproduces the `lucide lucide-<name>` classes lucide stamps
 * on every icon; theme.custom.css reads them, and upstream tests assert them to identify which
 * icon rendered (e.g. `lucide-x` in MessagesTimeline.test.tsx). Names are the lucide export
 * kebab-cased. A lucide alias re-exports its canonical row, so a glyph can't drift between names.
 */
function icon(lucideName: string, data: IconSvgElement, policy: FillPolicy): LucideIcon {
  const lucideClasses = withPascalKebabClass(`lucide lucide-${lucideName}`, lucideName);
  const Wrapped: LucideIcon = ({ weight, className, ...props }) => {
    const themed = forkPaletteFillsIcons(useActiveForkPalette());
    const filled = weight
      ? weight === "fill"
      : policy === "fill" || (policy === "themed" && themed);
    return (
      <HugeGlyph
        {...props}
        data={data}
        filled={filled}
        className={className ? `${lucideClasses} ${className}` : lucideClasses}
      />
    );
  };
  Wrapped.displayName = `Hugeicon(${lucideName})`;
  return Wrapped;
}

// The two blocked-on-you thread statuses (SidebarV2StatusIndicator) draw a ring with its right
// half solid, told apart from Done's dot by form; deriving it from Contrast fills the whole disc.
// Radius 9 inks ~81% of the grid, so the 12px mark is the design's 9.75px.
const CircleHalfRight: IconSvgElement = [
  [
    "circle",
    { cx: "12", cy: "12", r: "9", stroke: "currentColor", strokeWidth: "1.5", key: "ring" },
  ],
  ["path", { d: "M12 3a9 9 0 0 1 0 18z", fill: "currentColor", key: "half" }],
];

export const ChevronDownIcon = icon("chevron-down", Hg.ChevronDownIcon, "stroke");
export const ChevronDown = ChevronDownIcon;
export const ChevronUpIcon = icon("chevron-up", Hg.ChevronUpIcon, "stroke");
export const ChevronLeftIcon = icon("chevron-left", Hg.ChevronLeftIcon, "stroke");
export const ChevronRightIcon = icon("chevron-right", Hg.ChevronRightIcon, "stroke");
export const ChevronRight = ChevronRightIcon;
export const ChevronsUpDownIcon = icon("chevrons-up-down", Hg.UnfoldMoreIcon, "stroke");
export const ChevronsDownUpIcon = icon("chevrons-down-up", Hg.ChevronsDownUpIcon, "stroke");
export const ChevronsLeftRightEllipsisIcon = icon(
  "chevrons-left-right-ellipsis",
  Hg.ChevronsLeftRightEllipsisIcon,
  "stroke",
);
export const XIcon = icon("x", Hg.XIcon, "stroke");
export const X = XIcon;
export const CircleXIcon = icon("circle-x", Hg.CircleXIcon, "themed");
export const CheckIcon = icon("check", Hg.CheckIcon, "stroke");
export const Check = CheckIcon;
export const CircleCheckIcon = icon("circle-check", Hg.CircleCheckIcon, "themed");
export const CircleIcon = icon("circle", Hg.CircleIcon, "themed");
export const CircleDashedIcon = icon("circle-dashed", Hg.CircleDashedIcon, "stroke");
export const CircleDotIcon = icon("circle-dot", Hg.CircleDotIcon, "themed");
export const CheckCircle2Icon = icon("check-circle-2", Hg.CircleCheckIcon, "themed");
export const PinIcon = icon("pin", Hg.Pin02Icon, "themed");
export const PinOffIcon = icon("pin-off", Hg.PinOffIcon, "stroke");
export const PlusIcon = icon("plus", Hg.PlusIcon, "stroke");
// lucide renamed PlusCircle -> CirclePlus; both names still resolve there, so
// both are exported here.
export const CirclePlusIcon = icon("circle-plus", Hg.CirclePlusIcon, "themed");
export const PlusCircleIcon = icon("plus-circle", Hg.CirclePlusIcon, "themed");
export const Plus = PlusIcon;
export const MinusIcon = icon("minus", Hg.MinusIcon, "stroke");
export const Minus = MinusIcon;
export const ArrowUpIcon = icon("arrow-up", Hg.ArrowUp02Icon, "stroke");
export const ArrowDownIcon = icon("arrow-down", Hg.ArrowDown02Icon, "stroke");
export const ArrowLeftIcon = icon("arrow-left", Hg.ArrowLeft02Icon, "stroke");
export const ArrowLeft = ArrowLeftIcon;
export const ArrowRightIcon = icon("arrow-right", Hg.ArrowRight02Icon, "stroke");
export const ArrowRight = ArrowRightIcon;
export const ArrowUpDownIcon = icon("arrow-up-down", Hg.ArrowUpDownIcon, "stroke");
export const ArrowDownUpIcon = icon("arrow-down-up", Hg.ArrowUpDownIcon, "stroke");
export const ArrowUpRightIcon = icon("arrow-up-right", Hg.ArrowUpRightIcon, "stroke");
export const ArrowUpRight = ArrowUpRightIcon;
export const ArrowDown01Icon = icon("arrow-down-01", Hg.SortingOneNineIcon, "stroke");
export const ArrowDown01 = ArrowDown01Icon;
export const ArrowUpCircleIcon = icon("arrow-up-circle", Hg.CircleArrowUpIcon, "themed");
export const CornerLeftUpIcon = icon("corner-left-up", Hg.CornerLeftUpIcon, "stroke");
export const Undo2Icon = icon("undo-2", Hg.Undo02Icon, "stroke");
export const Redo2Icon = icon("redo-2", Hg.Redo02Icon, "stroke");
export const CornerDownLeftIcon = icon("corner-down-left", Hg.CornerDownLeftIcon, "stroke");
export const CornerUpRightIcon = icon("corner-up-right", Hg.CornerUpRightIcon, "stroke");
export const ArrowUpLeftIcon = icon("arrow-up-left", Hg.ArrowUpLeftIcon, "stroke");
export const ArrowRightLeftIcon = icon("arrow-right-left", Hg.ArrowLeftRightIcon, "stroke");
export const CodeIcon = icon("code", Hg.CodeIcon, "stroke");
export const GitForkIcon = icon("git-fork", Hg.GitForkIcon, "stroke");
export const MessagesSquareIcon = icon("messages-square", Hg.MessagesSquareIcon, "themed");
export const Clock3Icon = icon("clock-3", Hg.Clock01Icon, "stroke");
export const CalendarClockIcon = icon("calendar-clock", Hg.CalendarClockIcon, "themed");
export const GripVerticalIcon = icon("grip-vertical", Hg.GripVerticalIcon, "stroke");
export const ListOrderedIcon = icon("list-ordered", Hg.ListOrderedIcon, "stroke");
export const SquareMenuIcon = icon("square-menu", Hg.MenuSquareIcon, "stroke");
export const UnplugIcon = icon("unplug", Hg.UnplugIcon, "stroke");
export const RouteIcon = icon("route", Hg.RouteIcon, "stroke");
export const RotateCcwIcon = icon("rotate-ccw", Hg.RotateCcwIcon, "stroke");
export const RotateCcw = RotateCcwIcon;
export const RotateCwIcon = icon("rotate-cw", Hg.RotateCwIcon, "stroke");
export const RotateCw = RotateCwIcon;
export const RefreshCwIcon = icon("refresh-cw", Hg.RefreshCwIcon, "stroke");
export const RefreshCw = RefreshCwIcon;
export const HistoryIcon = icon("history", Hg.HistoryIcon, "stroke");
export const History = HistoryIcon;
export const ClockIcon = icon("clock", Hg.ClockIcon, "themed");
export const AlarmClockIcon = icon("alarm-clock", Hg.AlarmClockIcon, "themed");
export const AlarmClockCheckIcon = icon("alarm-clock-check", Hg.AlarmClockCheckIcon, "themed");
export const AlarmClockCheck = AlarmClockCheckIcon;
export const AlarmClockOffIcon = icon("alarm-clock-off", Hg.AlarmClockOffIcon, "stroke");
export const TriangleAlertIcon = icon("triangle-alert", Hg.TriangleAlertIcon, "themed");
export const AlertTriangleIcon = icon("alert-triangle", Hg.TriangleAlertIcon, "themed");
export const CircleAlertIcon = icon("circle-alert", Hg.AlertCircleIcon, "themed");
export const OctagonAlertIcon = icon("octagon-alert", Hg.OctagonAlertIcon, "themed");
export const InfoIcon = icon("info", Hg.InfoIcon, "themed");
export const BugIcon = icon("bug", Hg.BugIcon, "themed");
export const LoaderIcon = icon("loader", Hg.LoaderIcon, "stroke");
export const LoaderCircleIcon = icon("loader-circle", Hg.LoaderCircleIcon, "stroke");
export const LoaderCircle = LoaderCircleIcon;
export const Loader2Icon = icon("loader-2", Hg.LoaderCircleIcon, "stroke");
export const FileIcon = icon("file", Hg.FileIcon, "themed");
export const Files = icon("files", Hg.FilesIcon, "themed");
export const FileDiff = icon("file-diff", Hg.FileDiffIcon, "stroke");
export const FileDiffIcon = FileDiff;
export const FileJsonIcon = icon("file-json", Hg.FileCodeIcon, "themed");
export const FileCode2Icon = icon("file-code-2", Hg.FileCodeIcon, "themed");
export const FileSearchIcon = icon("file-search", Hg.FileSearchIcon, "themed");
export const TextSearchIcon = icon("text-search", Hg.TextSearchIcon, "stroke");
export const ClipboardList = icon("clipboard-list", Hg.ClipboardListIcon, "stroke");
export const CopyIcon = icon("copy", Hg.CopyIcon, "themed");
export const ArchiveIcon = icon("archive", Hg.ArchiveIcon, "themed");
export const ArchiveX = icon("archive-x", Hg.ArchiveArrowUpIcon, "themed");
export const Trash2Icon = icon("trash-2", Hg.Delete02Icon, "themed");
export const Trash2 = Trash2Icon;
export const FolderIcon = icon("folder", Hg.FolderIcon, "themed");
export const FolderClosedIcon = icon("folder-closed", Hg.FolderClosedIcon, "themed");
export const FolderOpenIcon = icon("folder-open", Hg.FolderOpenIcon, "themed");
export const FolderPlusIcon = icon("folder-plus", Hg.FolderPlusIcon, "themed");
export const FoldersIcon = icon("folders", Hg.FoldersIcon, "themed");
export const FolderGitIcon = icon("folder-git", Hg.FolderGitIcon, "stroke");
export const FolderGit2Icon = icon("folder-git-2", Hg.FolderGit2Icon, "stroke");
export const FolderTree = icon("folder-tree", Hg.FolderTreeIcon, "themed");
export const GitBranchIcon = icon("git-branch", Hg.GitBranchIcon, "stroke");
export const GitBranchPlusIcon = icon("git-branch-plus", Hg.GitBranchPlusIcon, "stroke");
export const GitCommitIcon = icon("git-commit", Hg.GitCommitIcon, "themed");
export const GitCommitHorizontalIcon = icon(
  "git-commit-horizontal",
  Hg.GitCommitHorizontalIcon,
  "themed",
);
export const GitPullRequestIcon = icon("git-pull-request", Hg.GitPullRequestIcon, "stroke");
export const GitPullRequest = GitPullRequestIcon;
export const GitPullRequestClosedIcon = icon(
  "git-pull-request-closed",
  Hg.GitPullRequestClosedIcon,
  "stroke",
);
export const GitPullRequestDraftIcon = icon(
  "git-pull-request-draft",
  Hg.GitPullRequestDraftIcon,
  "stroke",
);
export const GitMergeIcon = icon("git-merge", Hg.GitMergeIcon, "stroke");
export const TerminalIcon = icon("terminal", Hg.TerminalIcon, "stroke");
export const TerminalSquare = icon("terminal-square", Hg.SquareTerminalIcon, "themed");
export const Code2 = icon("code-2", Hg.SourceCodeIcon, "stroke");
export const HammerIcon = icon("hammer", Hg.HammerIcon, "themed");
export const WrenchIcon = icon("wrench", Hg.WrenchIcon, "themed");
export const FlaskConicalIcon = icon("flask-conical", Hg.FlaskConicalIcon, "stroke");
export const ContainerIcon = icon("container", Hg.ContainerIcon, "themed");
export const ServerIcon = icon("server", Hg.ServerIcon, "themed");
export const CloudIcon = icon("cloud", Hg.CloudIcon, "stroke");
export const CloudUploadIcon = icon("cloud-upload", Hg.CloudUploadIcon, "stroke");
export const GlobeIcon = icon("globe", Hg.GlobeIcon, "themed");
export const Globe = GlobeIcon;
export const Globe2 = icon("globe-2", Hg.Globe02Icon, "themed");
export const Globe2Icon = Globe2;
export const WifiOffIcon = icon("wifi-off", Hg.WifiOffIcon, "stroke");
export const RadioTower = icon("radio-tower", Hg.RadioTowerIcon, "stroke");
export const QrCodeIcon = icon("qr-code", Hg.QrCodeIcon, "stroke");
export const KeyboardIcon = icon("keyboard", Hg.KeyboardIcon, "themed");
export const MonitorIcon = icon("monitor", Hg.MonitorIcon, "themed");
export const LaptopIcon = icon("laptop", Hg.LaptopIcon, "themed");
export const SmartphoneIcon = icon("smartphone", Hg.SmartphoneIcon, "themed");
export const ActivityIcon = icon("activity", Hg.ActivityIcon, "stroke");
// Fork-only glyphs matching the iOS status pill and queue card.
export const ComputerActivityIcon = icon("computer-activity", Hg.ComputerActivityIcon, "stroke");
export const ComputerTerminalIcon = icon("computer-terminal", Hg.ComputerTerminal01Icon, "stroke");
export const ElectricityStackIcon = icon("electricity-stack", Hg.ElectricityStackIcon, "stroke");
export const PencilEditIcon = icon("pencil-edit", Hg.PencilEdit02Icon, "stroke");
export const ListNumberIcon = icon("list-number", Hg.LeftToRightListNumberIcon, "stroke");
export const BatteryIcon = icon("battery", Hg.BatteryIcon, "themed");
export const CpuIcon = icon("cpu", Hg.CpuIcon, "themed");
export const DatabaseIcon = icon("database", Hg.DatabaseIcon, "themed");
export const GaugeIcon = icon("gauge", Hg.GaugeIcon, "themed");
export const HardDriveIcon = icon("hard-drive", Hg.HardDriveIcon, "themed");
export const MemoryStickIcon = icon("memory-stick", Hg.MemoryStickIcon, "themed");
export const BotIcon = icon("bot", Hg.BotIcon, "themed");
export const Bot = BotIcon;
export const Braces = icon("braces", Hg.BracesIcon, "stroke");
export const LightbulbIcon = icon("lightbulb", Hg.LightbulbIcon, "themed");
// oxlint-disable-next-line t3code/no-sparkles-icon -- a user-picked project icon resolves "sparkles" by name
export const SparklesIcon = icon("sparkles", Hg.SparklesIcon, "themed");
export const ZapIcon = icon("zap", Hg.ZapIcon, "themed");
export const StarIcon = icon("star", Hg.StarIcon, "themed");
export const BookmarkIcon = icon("bookmark", Hg.BookmarkIcon, "themed");
export const LockIcon = icon("lock", Hg.SquareLock02Icon, "themed");
export const LockOpenIcon = icon("lock-open", Hg.LockOpenIcon, "themed");
export const LogInIcon = icon("log-in", Hg.LogInIcon, "stroke");
export const EyeIcon = icon("eye", Hg.EyeIcon, "themed");
export const Eye = EyeIcon;
export const EyeOffIcon = icon("eye-off", Hg.EyeOffIcon, "stroke");
export const SearchIcon = icon("search", Hg.SearchIcon, "themed");
export const Search = SearchIcon;
export const SettingsIcon = icon("settings", Hg.SettingsIcon, "themed");
export const Settings2Icon = icon("settings-2", Hg.Settings02Icon, "themed");
export const DownloadIcon = icon("download", Hg.DownloadIcon, "stroke");
export const UploadIcon = icon("upload", Hg.UploadIcon, "stroke");
export const ExternalLinkIcon = icon("external-link", Hg.ExternalLinkIcon, "stroke");
export const ExternalLink = ExternalLinkIcon;
export const LinkIcon = icon("link", Hg.LinkIcon, "stroke");
export const Link2 = icon("link-2", Hg.Link02Icon, "stroke");
export const Link2Icon = Link2;
export const MessageSquareIcon = icon("message-square", Hg.MessageSquareIcon, "themed");
export const MessageSquareWarningIcon = icon(
  "message-square-warning",
  Hg.MessageSquareWarningIcon,
  "themed",
);
export const MessageSquareOffIcon = icon("message-square-off", Hg.MessageSquareOffIcon, "stroke");
export const MessageCircle = icon("message-circle", Hg.MessageCircleIcon, "themed");
export const MessageCircleIcon = MessageCircle;
export const MessageCircleQuestionIcon = icon(
  "message-circle-question",
  Hg.MessageCircleQuestionMarkIcon,
  "themed",
);
export const EllipsisIcon = icon("ellipsis", Hg.EllipsisIcon, "stroke");
export const MoreHorizontalIcon = EllipsisIcon;
export const MoreVertical = icon("more-vertical", Hg.MoreVerticalIcon, "stroke");
export const PlayIcon = icon("play", Hg.PlayIcon, "themed");
export const Play = PlayIcon;
export const ListChecksIcon = icon("list-checks", Hg.ListChecksIcon, "stroke");
export const ListTodoIcon = icon("list-todo", Hg.ListTodoIcon, "stroke");
export const ListFilterIcon = icon("list-filter", Hg.ListFilterIcon, "stroke");
export const Camera = icon("camera", Hg.CameraIcon, "themed");
export const PaperclipIcon = icon("paperclip", Hg.PaperclipIcon, "stroke");
export const SendIcon = icon("send", Hg.SendIcon, "themed");
export const UserPlusIcon = icon("user-plus", Hg.UserPlusIcon, "themed");
export const UsersIcon = icon("users", Hg.UsersIcon, "themed");
export const LayersIcon = icon("layers", Hg.LayersIcon, "themed");
export const PipetteIcon = icon("pipette", Hg.PipetteIcon, "themed");
export const PaletteIcon = icon("palette", Hg.PaletteIcon, "themed");
export const PaintbrushIcon = icon("paintbrush", Hg.PaintbrushIcon, "themed");
export const ScanIcon = icon("scan", Hg.ScanIcon, "stroke");
export const FoldHorizontalIcon = icon("fold-horizontal", Hg.FoldHorizontalIcon, "stroke");
export const Grid2x2Icon = icon("grid-2x2", Hg.Grid2x2Icon, "themed");
export const Paintbrush = PaintbrushIcon;
export const PencilRulerIcon = icon("pencil-ruler", Hg.PencilRulerIcon, "themed");
export const PenLineIcon = icon("pen-line", Hg.PenLineIcon, "themed");
export const PenLine = PenLineIcon;
export const SquarePenIcon = icon("square-pen", Hg.SquarePenIcon, "themed");
export const Frame = icon("frame", Hg.FrameIcon, "stroke");
export const MousePointerClick = icon("mouse-pointer-click", Hg.MousePointerClickIcon, "themed");
export const MousePointerClickIcon = MousePointerClick;
export const MousePointer2 = icon("mouse-pointer-2", Hg.Cursor01Icon, "themed");
export const MousePointer2Icon = MousePointer2;
export const Maximize2Icon = icon("maximize-2", Hg.ArrowExpand01Icon, "stroke");
export const Minimize2Icon = icon("minimize-2", Hg.ArrowShrink02Icon, "stroke");
export const PanelLeftIcon = icon("panel-left", Hg.PanelLeftIcon, "themed");
export const PanelLeftCloseIcon = icon("panel-left-close", Hg.PanelLeftCloseIcon, "themed");
// The workspace panel toggles fill the half they control, so the pair reads as "this edge" /
// "that edge" at a glance (the design's half squares). The fill traces Hugeicons' own squircle.
const PanelRightHalf: IconSvgElement = [
  ...Hg.PanelRightIcon,
  [
    "path",
    {
      d: "M15 3H13C16.7712 3 18.6569 3 19.8284 4.17157C21 5.34315 21 7.22876 21 11V13C21 16.7712 21 18.6569 19.8284 19.8284C18.6569 21 16.7712 21 13 21H15V3Z",
      fill: "currentColor",
      key: "half",
    },
  ],
];
const PanelBottomHalf: IconSvgElement = [
  ...Hg.PanelBottomIcon,
  [
    "path",
    {
      d: "M2.49219 12.0001C2.49219 16.4785 2.49219 18.7176 3.88343 20.1089C5.27467 21.5001 7.51384 21.5001 11.9922 21.5001C16.4705 21.5001 18.7097 21.5001 20.1009 20.1089C21.4922 18.7176 21.4922 16.4785 21.4922 12.0001V15.0001H2.49219V12.0001Z",
      fill: "currentColor",
      key: "half",
    },
  ],
];
export const PanelRightIcon = icon("panel-right", PanelRightHalf, "stroke");
export const PanelBottomIcon = icon("panel-bottom", PanelBottomHalf, "stroke");
export const PictureInPicture2 = icon("picture-in-picture-2", Hg.PictureInPictureIcon, "stroke");
export const Columns2Icon = icon("columns-2", Hg.LayoutTwoColumnIcon, "themed");
// Fork-only (no lucide name): docks a thread as the column's right pane.
export const DockRightIcon = icon("dock-right", Hg.LayoutRightIcon, "themed");
export const Rows3Icon = icon("rows-3", Hg.Rows3Icon, "themed");
export const SquareSplitHorizontal = icon(
  "square-split-horizontal",
  Hg.SquareSplitHorizontalIcon,
  "stroke",
);
export const SquareSplitVertical = icon(
  "square-split-vertical",
  Hg.SquareSplitVerticalIcon,
  "stroke",
);
export const TextWrapIcon = icon("text-wrap", Hg.TextWrapIcon, "stroke");
export const WrapTextIcon = icon("wrap-text", Hg.TextWrapIcon, "stroke");
export const PilcrowIcon = icon("pilcrow", Hg.PilcrowIcon, "stroke");
export const BookOpenIcon = icon("book-open", Hg.BookOpenIcon, "themed");
export const MoonIcon = icon("moon", Hg.Moon02Icon, "themed");
export const SunIcon = icon("sun", Hg.SunIcon, "themed");
export const ChartNoAxesColumnIcon = icon(
  "chart-no-axes-column",
  Hg.ChartNoAxesColumnIcon,
  "themed",
);
export const Unlink2 = icon("unlink-2", Hg.UnlinkIcon, "stroke");
export const Link2OffIcon = icon("link-2-off", Hg.Unlink02Icon, "stroke");
export const CableIcon = icon("cable", Hg.CableIcon, "stroke");
export const ClipboardCopyIcon = icon("clipboard-copy", Hg.ClipboardCopyIcon, "stroke");
export const AtSignIcon = icon("at-sign", Hg.AtSignIcon, "stroke");
export const AppWindowIcon = icon("app-window", Hg.AppWindowIcon, "stroke");
export const CircleHelpIcon = icon("circle-help", Hg.HelpCircleIcon, "stroke");
export const UnfoldVerticalIcon = icon("unfold-vertical", Hg.UnfoldVerticalIcon, "stroke");
export const FoldVerticalIcon = icon("fold-vertical", Hg.FoldVerticalIcon, "stroke");
export const ClockAlertIcon = icon("clock-alert", Hg.ClockAlertIcon, "stroke");
export const CloudDownloadIcon = icon("cloud-download", Hg.CloudDownloadIcon, "stroke");
export const PencilIcon = icon("pencil", Hg.PencilIcon, "stroke");
export const CircleSlashIcon = icon("circle-slash", Hg.CircleSlashIcon, "stroke");
export const SmilePlusIcon = icon("smile-plus", Hg.SmilePlusIcon, "stroke");
export const TagIcon = icon("tag", Hg.TagIcon, "themed");
export const ShieldCheckIcon = icon("shield-check", Hg.ShieldCheckIcon, "themed");
export const BlocksIcon = icon("blocks", Hg.BlocksIcon, "themed");
export const XCircleIcon = CircleXIcon;

export const PackageIcon = icon("package", Hg.PackageIcon, "themed");
export const PackagePlusIcon = DownloadIcon;
export const UserRoundIcon = icon("user-round", Hg.UserRoundIcon, "themed");
export const Volume2 = icon("volume-2", Hg.VolumeHighIcon, "themed");
export const VolumeOff = icon("volume-off", Hg.VolumeOffIcon, "stroke");
export const SkipBackIcon = icon("skip-back", Hg.SkipBackIcon, "themed");
export const SkipForwardIcon = icon("skip-forward", Hg.SkipForwardIcon, "themed");
export const ListMusicIcon = icon("list-music", Hg.ListMusicIcon, "stroke");
export const ShuffleIcon = icon("shuffle", Hg.ShuffleIcon, "stroke");
export const RepeatIcon = icon("repeat", Hg.RepeatIcon, "stroke");
export const Repeat1Icon = icon("repeat-1", Hg.RepeatOneIcon, "stroke");
export const Square = icon("square", Hg.SquareIcon, "themed");

export const TargetIcon = icon("target", Hg.TargetIcon, "stroke");
export const MessageSquareTextIcon = icon(
  "message-square-text",
  Hg.MessageSquareTextIcon,
  "themed",
);
export const SquareIcon = Square;
export const InboxIcon = icon("inbox", Hg.InboxIcon, "themed");

export const FileTextIcon = icon("file-text", Hg.FileTextIcon, "themed");
export const FileSpreadsheetIcon = icon("file-spreadsheet", Hg.FileSpreadsheetIcon, "themed");
export const PresentationIcon = icon("presentation", Hg.PresentationIcon, "themed");
export const MailIcon = icon("mail", Hg.MailIcon, "themed");
export const ImageIcon = icon("image", Hg.ImageIcon, "themed");
export const BrainIcon = icon("brain", Hg.BrainIcon, "stroke");
export const CalendarArrowDownIcon = icon(
  "calendar-arrow-down",
  Hg.CalendarArrowDownIcon,
  "stroke",
);
export const CalendarArrowUpIcon = icon("calendar-arrow-up", Hg.CalendarArrowUpIcon, "stroke");

// Fork-only glyphs with no lucide counterpart: the sidebar chrome's New agent
// and Usage rows (Figma 364:11246) and the thread card's blocked-on-you
// status mark (364:17299). Exported through the shim so every fork icon
// shares one weight policy and one `lucide` class prefix.
export const NavigationArrowIcon = icon("navigation-arrow", Hg.Navigation03Icon, "themed");
export const ChartDonutIcon = icon("chart-donut", Hg.ChartRingIcon, "themed");
export const CircleHalfIcon = icon("circle-half", CircleHalfRight, "stroke");
export const FadersHorizontalIcon = icon("faders-horizontal", Hg.SlidersHorizontalIcon, "stroke");
// The model picker's favourite toggle.
export const HeartIcon = icon("heart", Hg.HeartIcon, "themed");
export const EllipsisVerticalIcon = icon("ellipsis-vertical", Hg.EllipsisVerticalIcon, "stroke");

export const ScaleIcon = icon("scale", Hg.ScaleIcon, "themed");
export const MicIcon = icon("mic", Hg.MicIcon, "themed");
export const MicOffIcon = icon("mic-off", Hg.MicOffIcon, "stroke");
export const KeyRoundIcon = icon("key-round", Hg.KeyRoundIcon, "themed");
export const LanguagesIcon = icon("languages", Hg.LanguagesIcon, "stroke");
export const AudioLinesIcon = icon("audio-lines", Hg.AudioLinesIcon, "stroke");
export const TypeIcon = icon("type", Hg.TypeIcon, "stroke");
export const MessageSquarePlusIcon = icon(
  "message-square-plus",
  Hg.MessageSquarePlusIcon,
  "themed",
);
export const EraserIcon = icon("eraser", Hg.EraserIcon, "stroke");
export const ListTreeIcon = icon("list-tree", Hg.ListTreeIcon, "stroke");
export const BuildingIcon = icon("building", Hg.BuildingIcon, "themed");
export const MessagesSquare = MessagesSquareIcon;
export const FolderTreeIcon = FolderTree;
export const BracesIcon = Braces;
export const CircuitBoardIcon = icon("circuit-board", Hg.CircuitBoardIcon, "themed");
export const CloudCogIcon = icon("cloud-cog", Hg.CloudCogIcon, "stroke");
export const Code2Icon = Code2;
export const FolderCodeIcon = icon("folder-code", Hg.FolderCodeIcon, "stroke");
export const Gamepad2Icon = icon("gamepad-2", Hg.GamepadIcon, "themed");
export const Layers3Icon = icon("layers-3", Hg.Layers01Icon, "themed");
export const Layers3 = Layers3Icon;
export const MusicIcon = icon("music", Hg.MusicIcon, "themed");
export const YarnIcon = icon("yarn", Hg.SpoolIcon, "themed");
export const ShoppingBagIcon = icon("shopping-bag", Hg.ShoppingBagIcon, "themed");
export const VideoIcon = icon("video", Hg.VideoIcon, "themed");
export const ChevronLeft = ChevronLeftIcon;
export const QuoteIcon = icon("quote", Hg.QuoteIcon, "themed");
export const TextIcon = icon("text", Hg.TextIcon, "stroke");
export const PanelsTopLeftIcon = icon("panels-top-left", Hg.PanelsTopLeftIcon, "themed");
export const TrendingDownIcon = icon("trending-down", Hg.TrendingDownIcon, "stroke");
export const TrendingUpIcon = icon("trending-up", Hg.TrendingUpIcon, "stroke");
export const TicketIcon = icon("ticket", Hg.TicketIcon, "themed");
export const SlidersHorizontalIcon = icon("sliders-horizontal", Hg.SlidersHorizontalIcon, "stroke");
export const RocketIcon = icon("rocket", Hg.RocketIcon, "stroke");
export const WorkflowIcon = icon("workflow", Hg.WorkflowIcon, "stroke");
export const MessageSquareDashedIcon = icon(
  "message-square-dashed",
  Hg.MessageSquareDashedIcon,
  "stroke",
);
export const CalendarIcon = icon("calendar", Hg.CalendarIcon, "themed");
export const Smartphone = SmartphoneIcon;
export const CircleArrowUpIcon = ArrowUpCircleIcon;
export const ShieldIcon = icon("shield", Hg.ShieldIcon, "themed");
export const ShieldOffIcon = icon("shield-off", Hg.ShieldOffIcon, "stroke");
export const FlaskConicalOffIcon = icon("flask-conical-off", Hg.FlaskConicalOffIcon, "stroke");
export const UserIcon = icon("user", Hg.UserIcon, "themed");
export const CircleStopIcon = icon("circle-stop", Hg.StopCircleIcon, "themed");
export const PauseIcon = icon("pause", Hg.PauseIcon, "themed");
export const MaximizeIcon = icon("maximize", Hg.FullScreenIcon, "stroke");
export const CircleDotDashedIcon = icon("circle-dot-dashed", Hg.CircleDotDashedIcon, "stroke");
export const ShieldQuestionIcon = icon("shield-question", Hg.ShieldQuestionMarkIcon, "themed");
export const SquareArrowOutUpRightIcon = ExternalLinkIcon;
export const FilmIcon = icon("film", Hg.FilmIcon, "themed");
export const Home = icon("home", Hg.HomeIcon, "themed");
export const Keyboard = KeyboardIcon;
export const Box = icon("box", Hg.BoxIcon, "stroke");
export const Maximize = MaximizeIcon;
export const Moon = MoonIcon;
export const MoreHorizontal = MoreHorizontalIcon;
export const Power = icon("power", Hg.PowerIcon, "stroke");
export const SlidersHorizontal = SlidersHorizontalIcon;
export const Sun = SunIcon;
export const Type = TypeIcon;
export const CircleAlert = CircleAlertIcon;
export const Table2 = icon("table-2", Hg.TableIcon, "themed");
export const GitPullRequestArrowIcon = GitPullRequestIcon;
export const Unlink2Icon = Unlink2;
export const UserCheckIcon = icon("user-check", Hg.UserCheckIcon, "themed");
export const UserRoundXIcon = icon("user-round-x", Hg.UserRoundXIcon, "themed");
export const Plug2Icon = icon("plug-2", Hg.PlugIcon, "themed");
export const PlugIcon = icon("plug", Hg.PlugIcon, "themed");
export const Volume2Icon = Volume2;
export const VolumeOffIcon = VolumeOff;
export const ReplyIcon = icon("reply", Hg.ReplyIcon, "stroke");
export const ListPlusIcon = icon("list-plus", Hg.ListPlusIcon, "stroke");
export const Table2Icon = Table2;
export const ScrollTextIcon = icon("scroll-text", Hg.ScrollTextIcon, "themed");
export const OctagonXIcon = icon("octagon-x", Hg.OctagonXIcon, "themed");
export const UnlinkIcon = icon("unlink", Hg.UnlinkIcon, "stroke");
export const UserLockIcon = icon("user-lock", Hg.UserLockIcon, "themed");

/**
 * lucide's escape hatch for one-off glyphs drawn from path data (upstream's
 * settings snap-shot entry uses it). There is no Hugeicons counterpart to swap
 * in, so this renders the lucide node list verbatim with lucide's default
 * stroke attributes, under the same class contract as the table above.
 */
type LucideIconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;
export function createLucideIcon(lucideName: string, iconNode: LucideIconNode): LucideIcon {
  const lucideClasses = `lucide lucide-${lucideName}`;
  const Drawn: LucideIcon = ({ className, size, weight: _weight, alt, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size ?? 24}
      height={size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={alt}
      {...props}
      className={className ? `${lucideClasses} ${className}` : lucideClasses}
    >
      {iconNode.map(([tag, attrs]): ReactElement => createElement(tag, attrs))}
    </svg>
  );
  Drawn.displayName = `Lucide(${lucideName})`;
  return Drawn;
}
