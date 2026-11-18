/**
 * fork: lucide-react -> Hugeicons (free, Stroke Rounded).
 *
 * `lucide-react` is aliased to this module in `apps/web/vite.config.ts` and
 * `apps/web/tsconfig.json`, so every upstream import site keeps saying
 * `from "lucide-react"` and renders Hugeicons instead: one additive file plus
 * two low-churn config edits, not a rewrite of every hot component.
 *
 * The free set ships outlines only. The weight table below is the policy the
 * Phosphor shim used: `duotone` glyphs draw a filled weight under the fork
 * palettes (useForkIconWeight), `bold` glyphs (arrows, checks, carets: nothing
 * enclosed) always stay stroked, and `fill` always fills. The filled weight is
 * derived from the outline in `hugeiconsFill.ts`; an icon with nothing closed
 * to fill keeps its stroke.
 *
 * Adding an icon: if an upstream sync introduces a lucide import this module
 * does not export, the build fails naming that icon. Add a line to the table.
 *
 * See .fork/customizations.yaml#phosphor-duotone-icons (the id predates the
 * Hugeicons swap).
 */
import {
  ActivityIcon as HgActivity,
  AlarmClockCheckIcon as HgAlarmClockCheck,
  AlarmClockIcon as HgAlarmClock,
  AlarmClockOffIcon as HgAlarmClockOff,
  AlertCircleIcon as HgAlertCircle,
  ArchiveIcon as HgArchive,
  ArchiveXIcon as HgArchiveX,
  ArrowDown02Icon as HgArrowDown02,
  ArrowExpand01Icon as HgArrowExpand01,
  ArrowLeft02Icon as HgArrowLeft02,
  ArrowLeftRightIcon as HgArrowLeftRight,
  ArrowRight02Icon as HgArrowRight02,
  ArrowShrink02Icon as HgArrowShrink02,
  ArrowUp02Icon as HgArrowUp02,
  ArrowUpDownIcon as HgArrowUpDown,
  ArrowUpLeftIcon as HgArrowUpLeft,
  ArrowUpRightIcon as HgArrowUpRight,
  AudioLinesIcon as HgAudioLines,
  BatteryIcon as HgBattery,
  BlocksIcon as HgBlocks,
  BookOpenIcon as HgBookOpen,
  BookmarkIcon as HgBookmark,
  BotIcon as HgBot,
  BoxIcon as HgBox,
  BracesIcon as HgBraces,
  BrainIcon as HgBrain,
  BugIcon as HgBug,
  BuildingIcon as HgBuilding,
  CalendarArrowDownIcon as HgCalendarArrowDown,
  CalendarArrowUpIcon as HgCalendarArrowUp,
  CalendarClockIcon as HgCalendarClock,
  CalendarIcon as HgCalendar,
  CameraIcon as HgCamera,
  ChartNoAxesColumnIcon as HgChartNoAxesColumn,
  ChartRingIcon as HgChartRing,
  CheckIcon as HgCheck,
  ChevronDownIcon as HgChevronDown,
  ChevronLeftIcon as HgChevronLeft,
  ChevronRightIcon as HgChevronRight,
  ChevronUpIcon as HgChevronUp,
  ChevronsDownUpIcon as HgChevronsDownUp,
  ChevronsLeftRightEllipsisIcon as HgChevronsLeftRightEllipsis,
  CircleArrowUpIcon as HgCircleArrowUp,
  CircleCheckIcon as HgCircleCheck,
  CircleDashedIcon as HgCircleDashed,
  CircleDotDashedIcon as HgCircleDotDashed,
  CircleDotIcon as HgCircleDot,
  CircleIcon as HgCircle,
  CirclePlusIcon as HgCirclePlus,
  CircleSlashIcon as HgCircleSlash,
  CircleXIcon as HgCircleX,
  CircuitBoardIcon as HgCircuitBoard,
  ClipboardListIcon as HgClipboardList,
  Clock01Icon as HgClock01,
  ClockIcon as HgClock,
  CloudCogIcon as HgCloudCog,
  CloudDownloadIcon as HgCloudDownload,
  CloudIcon as HgCloud,
  CloudUploadIcon as HgCloudUpload,
  CodeIcon as HgCode,
  ContainerIcon as HgContainer,
  ContrastIcon as HgContrast,
  CopyIcon as HgCopy,
  CornerLeftUpIcon as HgCornerLeftUp,
  CornerUpRightIcon as HgCornerUpRight,
  CpuIcon as HgCpu,
  Cursor01Icon as HgCursor01,
  DatabaseIcon as HgDatabase,
  Delete02Icon as HgDelete02,
  DownloadIcon as HgDownload,
  EllipsisIcon as HgEllipsis,
  EllipsisVerticalIcon as HgEllipsisVertical,
  EraserIcon as HgEraser,
  ExternalLinkIcon as HgExternalLink,
  EyeIcon as HgEye,
  EyeOffIcon as HgEyeOff,
  FileCodeIcon as HgFileCode,
  FileDiffIcon as HgFileDiff,
  FileIcon as HgFile,
  FileSearchIcon as HgFileSearch,
  FileSpreadsheetIcon as HgFileSpreadsheet,
  FileTextIcon as HgFileText,
  FilesIcon as HgFiles,
  FilmIcon as HgFilm,
  FlaskConicalIcon as HgFlaskConical,
  FlaskConicalOffIcon as HgFlaskConicalOff,
  FoldHorizontalIcon as HgFoldHorizontal,
  FolderClosedIcon as HgFolderClosed,
  FolderCodeIcon as HgFolderCode,
  FolderGit2Icon as HgFolderGit2,
  FolderGitIcon as HgFolderGit,
  FolderIcon as HgFolder,
  FolderOpenIcon as HgFolderOpen,
  FolderPlusIcon as HgFolderPlus,
  FolderTreeIcon as HgFolderTree,
  FoldersIcon as HgFolders,
  FrameIcon as HgFrame,
  FullScreenIcon as HgFullScreen,
  GamepadIcon as HgGamepad,
  GaugeIcon as HgGauge,
  GitBranchIcon as HgGitBranch,
  GitBranchPlusIcon as HgGitBranchPlus,
  GitCommitHorizontalIcon as HgGitCommitHorizontal,
  GitCommitIcon as HgGitCommit,
  GitForkIcon as HgGitFork,
  GitMergeIcon as HgGitMerge,
  GitPullRequestClosedIcon as HgGitPullRequestClosed,
  GitPullRequestDraftIcon as HgGitPullRequestDraft,
  GitPullRequestIcon as HgGitPullRequest,
  Globe02Icon as HgGlobe02,
  GlobeIcon as HgGlobe,
  Grid2x2Icon as HgGrid2x2,
  GripVerticalIcon as HgGripVertical,
  HammerIcon as HgHammer,
  HardDriveIcon as HgHardDrive,
  HeartIcon as HgHeart,
  HistoryIcon as HgHistory,
  HomeIcon as HgHome,
  ImageIcon as HgImage,
  InboxIcon as HgInbox,
  InfoIcon as HgInfo,
  KeyRoundIcon as HgKeyRound,
  KeyboardIcon as HgKeyboard,
  LanguagesIcon as HgLanguages,
  LaptopIcon as HgLaptop,
  Layers01Icon as HgLayers01,
  LayersIcon as HgLayers,
  LayoutTwoColumnIcon as HgLayoutTwoColumn,
  LightbulbIcon as HgLightbulb,
  Link02Icon as HgLink02,
  LinkIcon as HgLink,
  ListChecksIcon as HgListChecks,
  ListFilterIcon as HgListFilter,
  ListMusicIcon as HgListMusic,
  ListOrderedIcon as HgListOrdered,
  ListPlusIcon as HgListPlus,
  ListTodoIcon as HgListTodo,
  ListTreeIcon as HgListTree,
  LoaderCircleIcon as HgLoaderCircle,
  LoaderIcon as HgLoader,
  LockOpenIcon as HgLockOpen,
  LogInIcon as HgLogIn,
  MailIcon as HgMail,
  MemoryStickIcon as HgMemoryStick,
  MenuSquareIcon as HgMenuSquare,
  MessageCircleIcon as HgMessageCircle,
  MessageCircleQuestionMarkIcon as HgMessageCircleQuestionMark,
  MessageSquareDashedIcon as HgMessageSquareDashed,
  MessageSquareIcon as HgMessageSquare,
  MessageSquareOffIcon as HgMessageSquareOff,
  MessageSquarePlusIcon as HgMessageSquarePlus,
  MessageSquareTextIcon as HgMessageSquareText,
  MessageSquareWarningIcon as HgMessageSquareWarning,
  MessagesSquareIcon as HgMessagesSquare,
  MicIcon as HgMic,
  MicOffIcon as HgMicOff,
  MinusIcon as HgMinus,
  MonitorIcon as HgMonitor,
  Moon02Icon as HgMoon02,
  MoreVerticalIcon as HgMoreVertical,
  MousePointerClickIcon as HgMousePointerClick,
  MusicIcon as HgMusic,
  Navigation03Icon as HgNavigation03,
  OctagonAlertIcon as HgOctagonAlert,
  OctagonXIcon as HgOctagonX,
  PackageIcon as HgPackage,
  PaintbrushIcon as HgPaintbrush,
  PaletteIcon as HgPalette,
  PanelBottomIcon as HgPanelBottom,
  PanelLeftCloseIcon as HgPanelLeftClose,
  PanelLeftIcon as HgPanelLeft,
  PanelRightIcon as HgPanelRight,
  PanelsTopLeftIcon as HgPanelsTopLeft,
  PaperclipIcon as HgPaperclip,
  PauseIcon as HgPause,
  PenLineIcon as HgPenLine,
  PencilIcon as HgPencil,
  PencilRulerIcon as HgPencilRuler,
  PictureInPictureIcon as HgPictureInPicture,
  PilcrowIcon as HgPilcrow,
  PinIcon as HgPin,
  PinOffIcon as HgPinOff,
  PipetteIcon as HgPipette,
  PlayIcon as HgPlay,
  PlugIcon as HgPlug,
  PlusIcon as HgPlus,
  PowerIcon as HgPower,
  PresentationIcon as HgPresentation,
  QrCodeIcon as HgQrCode,
  QuoteIcon as HgQuote,
  RadioTowerIcon as HgRadioTower,
  Redo02Icon as HgRedo02,
  RefreshCwIcon as HgRefreshCw,
  RepeatIcon as HgRepeat,
  RepeatOneIcon as HgRepeatOne,
  ReplyIcon as HgReply,
  RocketIcon as HgRocket,
  RotateCcwIcon as HgRotateCcw,
  RotateCwIcon as HgRotateCw,
  RouteIcon as HgRoute,
  Rows3Icon as HgRows3,
  ScaleIcon as HgScale,
  ScanIcon as HgScan,
  ScrollTextIcon as HgScrollText,
  SearchIcon as HgSearch,
  SendIcon as HgSend,
  ServerIcon as HgServer,
  Settings02Icon as HgSettings02,
  SettingsIcon as HgSettings,
  ShieldCheckIcon as HgShieldCheck,
  ShieldIcon as HgShield,
  ShieldOffIcon as HgShieldOff,
  ShieldQuestionMarkIcon as HgShieldQuestionMark,
  ShoppingBagIcon as HgShoppingBag,
  ShuffleIcon as HgShuffle,
  SkipBackIcon as HgSkipBack,
  SkipForwardIcon as HgSkipForward,
  SlidersHorizontalIcon as HgSlidersHorizontal,
  SmartphoneIcon as HgSmartphone,
  SmilePlusIcon as HgSmilePlus,
  SortingOneNineIcon as HgSortingOneNine,
  SourceCodeIcon as HgSourceCode,
  SparklesIcon as HgSparkles,
  SpoolIcon as HgSpool,
  SquareIcon as HgSquare,
  SquareLock02Icon as HgSquareLock02,
  SquarePenIcon as HgSquarePen,
  SquareSplitHorizontalIcon as HgSquareSplitHorizontal,
  SquareSplitVerticalIcon as HgSquareSplitVertical,
  SquareTerminalIcon as HgSquareTerminal,
  StarIcon as HgStar,
  StopCircleIcon as HgStopCircle,
  SunIcon as HgSun,
  TableIcon as HgTable,
  TagIcon as HgTag,
  TargetIcon as HgTarget,
  TerminalIcon as HgTerminal,
  TextIcon as HgText,
  TextSearchIcon as HgTextSearch,
  TextWrapIcon as HgTextWrap,
  TicketIcon as HgTicket,
  TrendingDownIcon as HgTrendingDown,
  TrendingUpIcon as HgTrendingUp,
  TriangleAlertIcon as HgTriangleAlert,
  TypeIcon as HgType,
  Undo02Icon as HgUndo02,
  UnfoldMoreIcon as HgUnfoldMore,
  UnlinkIcon as HgUnlink,
  UnplugIcon as HgUnplug,
  UploadIcon as HgUpload,
  UserCheckIcon as HgUserCheck,
  UserIcon as HgUser,
  UserLockIcon as HgUserLock,
  UserPlusIcon as HgUserPlus,
  UserRoundIcon as HgUserRound,
  UserRoundXIcon as HgUserRoundX,
  UsersIcon as HgUsers,
  VideoIcon as HgVideo,
  VolumeHighIcon as HgVolumeHigh,
  VolumeOffIcon as HgVolumeOff,
  WifiOffIcon as HgWifiOff,
  WorkflowIcon as HgWorkflow,
  WrenchIcon as HgWrench,
  XIcon as HgX,
  ZapIcon as HgZap,
} from "@hugeicons/core-free-icons";
import type { FC, ReactElement, SVGProps } from "react";
import { createElement, useId } from "react";

import { forkPaletteFillsIcons, useActiveForkPalette } from "../forkActivePalette";
import { deriveFilledIcon, type IconSvgElement, isOutlinedStroke } from "./hugeiconsFill";

/** The Phosphor weights call sites and the table name; Hugeicons draws stroke or filled. */
export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

/**
 * Upstream assigns lucide icons into slots typed `React.FC<SVGProps<SVGSVGElement>>`
 * (see `~/components/Icons.tsx`), so the props stay assignable from plain SVG props under
 * `exactOptionalPropertyTypes`. `weight` and `mirrored` are the Phosphor-era extras fork
 * call sites still pass.
 */
type LucideCompatProps = SVGProps<SVGSVGElement> & {
  alt?: string | undefined;
  size?: string | number | undefined;
  weight?: IconWeight | undefined;
  mirrored?: boolean | undefined;
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

/** Duotone, or fill in its place under the fork palettes (`custom/forkActivePalette.ts`
    forkPaletteFillsIcons). Every other weight passes through. */
export function useForkIconWeight(weight: IconWeight): IconWeight {
  const fills = forkPaletteFillsIcons(useActiveForkPalette());
  return weight === "duotone" && fills ? "fill" : weight;
}

function drawn(element: IconSvgElement[number], override?: Record<string, string>): ReactElement {
  const [tag, attrs] = element;
  return createElement(tag, override ? { ...attrs, ...override } : attrs);
}

/** One Hugeicons glyph, stroked or with its derived fill (the body filled, interior detail cut
    out through a mask, anything outside the body still stroked). */
export function HugeGlyph({
  data,
  filled,
  size,
  alt,
  mirrored,
  ...props
}: Omit<LucideCompatProps, "weight"> & { data: IconSvgElement; filled: boolean }) {
  const maskId = `fork-icon-${useId().replace(/[^\w-]/g, "")}`;
  const fill = filled ? deriveFilledIcon(data) : null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size ?? "1em"}
      height={size ?? "1em"}
      viewBox="0 0 24 24"
      fill="none"
      transform={mirrored ? "scale(-1, 1)" : undefined}
      {...props}
    >
      {alt ? <title>{alt}</title> : null}
      {fill ? (
        <>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
              <rect width="24" height="24" fill="white" />
              {fill.knockouts.map((element) =>
                drawn(
                  element,
                  isOutlinedStroke(element[1])
                    ? { fill: "black" }
                    : { stroke: "black", fill: "none" },
                ),
              )}
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>
            {fill.bodies.map((element) => drawn(element, { fill: "currentColor" }))}
          </g>
          {fill.loose.map((element) => drawn(element))}
        </>
      ) : (
        data.map((element) => drawn(element))
      )}
    </svg>
  );
}

/**
 * Pins a default weight while still letting a caller override it per usage.
 * Each element carries its own stroke width, so an upstream `strokeWidth` on
 * the `<svg>` is inert rather than wrong.
 *
 * `lucideName` reproduces the `lucide lucide-<name>` classes lucide stamps on
 * every icon (see its `createLucideIcon`). theme.custom.css's low-density rule
 * reads them, and upstream tests assert them to identify which icon rendered —
 * e.g. `MessagesTimeline.test.tsx` expects `lucide-x` on a failed tool call.
 * Names are the lucide export kebab-cased. Pure lucide aliases share their
 * canonical wrapper so the same glyph cannot drift between two export names.
 */
function icon(lucideName: string, data: IconSvgElement, weight: IconWeight): LucideIcon {
  const lucideClasses = withPascalKebabClass(`lucide lucide-${lucideName}`, lucideName);
  const Wrapped: LucideIcon = ({ weight: override, className, ...props }) => {
    const resolved = useForkIconWeight(override ?? weight);
    return (
      <HugeGlyph
        {...props}
        data={data}
        filled={resolved === "fill"}
        className={className ? `${lucideClasses} ${className}` : lucideClasses}
      />
    );
  };
  Wrapped.displayName = `Hugeicon(${lucideName})`;
  return Wrapped;
}

export const ChevronDownIcon = icon("chevron-down", HgChevronDown, "bold");
export const ChevronDown = icon("chevron-down", HgChevronDown, "bold");
export const ChevronUpIcon = icon("chevron-up", HgChevronUp, "bold");
export const ChevronLeftIcon = icon("chevron-left", HgChevronLeft, "bold");
export const ChevronRightIcon = icon("chevron-right", HgChevronRight, "bold");
export const ChevronRight = icon("chevron-right", HgChevronRight, "bold");
export const ChevronsUpDownIcon = icon("chevrons-up-down", HgUnfoldMore, "bold");
export const ChevronsDownUpIcon = icon("chevrons-down-up", HgChevronsDownUp, "bold");
export const ChevronsLeftRightEllipsisIcon = icon(
  "chevrons-left-right-ellipsis",
  HgChevronsLeftRightEllipsis,
  "duotone",
);
export const XIcon = icon("x", HgX, "bold");
export const X = icon("x", HgX, "bold");
export const CircleXIcon = icon("circle-x", HgCircleX, "duotone");
export const CheckIcon = icon("check", HgCheck, "bold");
export const Check = icon("check", HgCheck, "bold");
export const CircleCheckIcon = icon("circle-check", HgCircleCheck, "duotone");
export const CircleIcon = icon("circle", HgCircle, "duotone");
export const CircleDashedIcon = icon("circle-dashed", HgCircleDashed, "duotone");
export const CircleDotIcon = icon("circle-dot", HgCircleDot, "duotone");
export const CheckCircle2Icon = icon("check-circle-2", HgCircleCheck, "duotone");
export const PinIcon = icon("pin", HgPin, "duotone");
export const PinOffIcon = icon("pin-off", HgPinOff, "duotone");
export const PlusIcon = icon("plus", HgPlus, "bold");
// lucide renamed PlusCircle -> CirclePlus; both names still resolve there, so
// both are exported here.
export const CirclePlusIcon = icon("circle-plus", HgCirclePlus, "duotone");
export const PlusCircleIcon = icon("plus-circle", HgCirclePlus, "duotone");
export const Plus = icon("plus", HgPlus, "bold");
export const MinusIcon = icon("minus", HgMinus, "bold");
export const Minus = icon("minus", HgMinus, "bold");
export const ArrowUpIcon = icon("arrow-up", HgArrowUp02, "bold");
export const ArrowDownIcon = icon("arrow-down", HgArrowDown02, "bold");
export const ArrowLeftIcon = icon("arrow-left", HgArrowLeft02, "bold");
export const ArrowLeft = icon("arrow-left", HgArrowLeft02, "bold");
export const ArrowRightIcon = icon("arrow-right", HgArrowRight02, "bold");
export const ArrowRight = icon("arrow-right", HgArrowRight02, "bold");
export const ArrowUpDownIcon = icon("arrow-up-down", HgArrowUpDown, "bold");
export const ArrowDownUpIcon = icon("arrow-down-up", HgArrowUpDown, "bold");
export const ArrowUpRightIcon = icon("arrow-up-right", HgArrowUpRight, "bold");
export const ArrowUpRight = ArrowUpRightIcon;
export const ArrowDown01Icon = icon("arrow-down-01", HgSortingOneNine, "bold");
export const ArrowDown01 = ArrowDown01Icon;
export const ArrowUpCircleIcon = icon("arrow-up-circle", HgCircleArrowUp, "duotone");
export const CornerLeftUpIcon = icon("corner-left-up", HgCornerLeftUp, "bold");
export const Undo2Icon = icon("undo-2", HgUndo02, "bold");
export const Redo2Icon = icon("redo-2", HgRedo02, "bold");
export const CornerUpRightIcon = icon("corner-up-right", HgCornerUpRight, "bold");
export const ArrowUpLeftIcon = icon("arrow-up-left", HgArrowUpLeft, "bold");
export const ArrowRightLeftIcon = icon("arrow-right-left", HgArrowLeftRight, "bold");
export const CodeIcon = icon("code", HgCode, "bold");
export const GitForkIcon = icon("git-fork", HgGitFork, "bold");
export const MessagesSquareIcon = icon("messages-square", HgMessagesSquare, "duotone");
export const Clock3Icon = icon("clock-3", HgClock01, "bold");
export const CalendarClockIcon = icon("calendar-clock", HgCalendarClock, "duotone");
export const GripVerticalIcon = icon("grip-vertical", HgGripVertical, "bold");
export const ListOrderedIcon = icon("list-ordered", HgListOrdered, "bold");
export const SquareMenuIcon = icon("square-menu", HgMenuSquare, "bold");
export const UnplugIcon = icon("unplug", HgUnplug, "bold");
export const RouteIcon = icon("route", HgRoute, "bold");
export const RotateCcwIcon = icon("rotate-ccw", HgRotateCcw, "bold");
export const RotateCcw = icon("rotate-ccw", HgRotateCcw, "bold");
export const RotateCwIcon = icon("rotate-cw", HgRotateCw, "bold");
export const RotateCw = icon("rotate-cw", HgRotateCw, "bold");
export const RefreshCwIcon = icon("refresh-cw", HgRefreshCw, "bold");
export const RefreshCw = icon("refresh-cw", HgRefreshCw, "bold");
export const HistoryIcon = icon("history", HgHistory, "duotone");
export const History = icon("history", HgHistory, "duotone");
export const ClockIcon = icon("clock", HgClock, "duotone");
export const AlarmClockIcon = icon("alarm-clock", HgAlarmClock, "duotone");
export const AlarmClockCheckIcon = icon("alarm-clock-check", HgAlarmClockCheck, "duotone");
export const AlarmClockCheck = AlarmClockCheckIcon;
export const AlarmClockOffIcon = icon("alarm-clock-off", HgAlarmClockOff, "duotone");
export const TriangleAlertIcon = icon("triangle-alert", HgTriangleAlert, "duotone");
export const AlertTriangleIcon = icon("alert-triangle", HgTriangleAlert, "duotone");
export const CircleAlertIcon = icon("circle-alert", HgAlertCircle, "duotone");
export const OctagonAlertIcon = icon("octagon-alert", HgOctagonAlert, "duotone");
export const InfoIcon = icon("info", HgInfo, "duotone");
export const BugIcon = icon("bug", HgBug, "duotone");
export const LoaderIcon = icon("loader", HgLoader, "bold");
export const LoaderCircleIcon = icon("loader-circle", HgLoaderCircle, "bold");
export const LoaderCircle = icon("loader-circle", HgLoaderCircle, "bold");
export const Loader2Icon = icon("loader-2", HgLoaderCircle, "bold");
export const FileIcon = icon("file", HgFile, "duotone");
export const Files = icon("files", HgFiles, "duotone");
export const FileDiff = icon("file-diff", HgFileDiff, "duotone");
export const FileDiffIcon = icon("file-diff", HgFileDiff, "duotone");
export const FileJsonIcon = icon("file-json", HgFileCode, "duotone");
export const FileCode2Icon = icon("file-code-2", HgFileCode, "duotone");
export const FileSearchIcon = icon("file-search", HgFileSearch, "duotone");
export const TextSearchIcon = icon("text-search", HgTextSearch, "duotone");
export const ClipboardList = icon("clipboard-list", HgClipboardList, "duotone");
export const CopyIcon = icon("copy", HgCopy, "duotone");
export const ArchiveIcon = icon("archive", HgArchive, "duotone");
export const ArchiveX = icon("archive-x", HgArchiveX, "duotone");
export const Trash2Icon = icon("trash-2", HgDelete02, "duotone");
export const Trash2 = icon("trash-2", HgDelete02, "duotone");
export const FolderIcon = icon("folder", HgFolder, "duotone");
export const FolderClosedIcon = icon("folder-closed", HgFolderClosed, "duotone");
export const FolderOpenIcon = icon("folder-open", HgFolderOpen, "duotone");
export const FolderPlusIcon = icon("folder-plus", HgFolderPlus, "duotone");
export const FoldersIcon = icon("folders", HgFolders, "duotone");
export const FolderGitIcon = icon("folder-git", HgFolderGit, "duotone");
export const FolderGit2Icon = icon("folder-git-2", HgFolderGit2, "duotone");
export const FolderTree = icon("folder-tree", HgFolderTree, "duotone");
export const GitBranchIcon = icon("git-branch", HgGitBranch, "duotone");
export const GitBranchPlusIcon = icon("git-branch-plus", HgGitBranchPlus, "duotone");
export const GitCommitIcon = icon("git-commit", HgGitCommit, "duotone");
export const GitCommitHorizontalIcon = icon(
  "git-commit-horizontal",
  HgGitCommitHorizontal,
  "duotone",
);
export const GitPullRequestIcon = icon("git-pull-request", HgGitPullRequest, "duotone");
export const GitPullRequest = icon("git-pull-request", HgGitPullRequest, "duotone");
export const GitPullRequestClosedIcon = icon(
  "git-pull-request-closed",
  HgGitPullRequestClosed,
  "duotone",
);
export const GitPullRequestDraftIcon = icon(
  "git-pull-request-draft",
  HgGitPullRequestDraft,
  "duotone",
);
export const GitMergeIcon = icon("git-merge", HgGitMerge, "duotone");
export const TerminalIcon = icon("terminal", HgTerminal, "duotone");
export const TerminalSquare = icon("terminal-square", HgSquareTerminal, "duotone");
export const Code2 = icon("code-2", HgSourceCode, "duotone");
export const HammerIcon = icon("hammer", HgHammer, "duotone");
export const WrenchIcon = icon("wrench", HgWrench, "duotone");
export const FlaskConicalIcon = icon("flask-conical", HgFlaskConical, "duotone");
export const ContainerIcon = icon("container", HgContainer, "duotone");
export const ServerIcon = icon("server", HgServer, "duotone");
export const CloudIcon = icon("cloud", HgCloud, "duotone");
export const CloudUploadIcon = icon("cloud-upload", HgCloudUpload, "duotone");
export const GlobeIcon = icon("globe", HgGlobe, "duotone");
export const Globe = icon("globe", HgGlobe, "duotone");
export const Globe2 = icon("globe-2", HgGlobe02, "duotone");
export const Globe2Icon = icon("globe-2", HgGlobe02, "duotone");
export const WifiOffIcon = icon("wifi-off", HgWifiOff, "duotone");
export const RadioTower = icon("radio-tower", HgRadioTower, "duotone");
export const QrCodeIcon = icon("qr-code", HgQrCode, "duotone");
export const KeyboardIcon = icon("keyboard", HgKeyboard, "duotone");
export const MonitorIcon = icon("monitor", HgMonitor, "duotone");
export const LaptopIcon = icon("laptop", HgLaptop, "duotone");
export const SmartphoneIcon = icon("smartphone", HgSmartphone, "duotone");
export const ActivityIcon = icon("activity", HgActivity, "bold");
export const BatteryIcon = icon("battery", HgBattery, "duotone");
export const CpuIcon = icon("cpu", HgCpu, "duotone");
export const DatabaseIcon = icon("database", HgDatabase, "duotone");
export const GaugeIcon = icon("gauge", HgGauge, "duotone");
export const HardDriveIcon = icon("hard-drive", HgHardDrive, "duotone");
export const MemoryStickIcon = icon("memory-stick", HgMemoryStick, "duotone");
export const BotIcon = icon("bot", HgBot, "duotone");
export const Bot = icon("bot", HgBot, "duotone");
export const Braces = icon("braces", HgBraces, "duotone");
export const LightbulbIcon = icon("lightbulb", HgLightbulb, "duotone");
// oxlint-disable-next-line t3code/no-sparkles-icon -- a user-picked project icon resolves "sparkles" by name
export const SparklesIcon = icon("sparkles", HgSparkles, "duotone");
export const ZapIcon = icon("zap", HgZap, "duotone");
export const StarIcon = icon("star", HgStar, "duotone");
export const BookmarkIcon = icon("bookmark", HgBookmark, "duotone");
export const LockIcon = icon("lock", HgSquareLock02, "duotone");
export const LockOpenIcon = icon("lock-open", HgLockOpen, "duotone");
export const LogInIcon = icon("log-in", HgLogIn, "duotone");
export const EyeIcon = icon("eye", HgEye, "duotone");
export const Eye = icon("eye", HgEye, "duotone");
export const EyeOffIcon = icon("eye-off", HgEyeOff, "duotone");
export const SearchIcon = icon("search", HgSearch, "duotone");
export const Search = icon("search", HgSearch, "duotone");
export const SettingsIcon = icon("settings", HgSettings, "duotone");
export const Settings2Icon = icon("settings-2", HgSettings02, "duotone");
export const DownloadIcon = icon("download", HgDownload, "bold");
export const UploadIcon = icon("upload", HgUpload, "bold");
export const ExternalLinkIcon = icon("external-link", HgExternalLink, "duotone");
export const ExternalLink = icon("external-link", HgExternalLink, "duotone");
export const LinkIcon = icon("link", HgLink, "duotone");
export const Link2 = icon("link-2", HgLink02, "duotone");
export const Link2Icon = icon("link-2", HgLink02, "duotone");
export const MessageSquareIcon = icon("message-square", HgMessageSquare, "duotone");
export const MessageSquareWarningIcon = icon(
  "message-square-warning",
  HgMessageSquareWarning,
  "duotone",
);
export const MessageSquareOffIcon = icon("message-square-off", HgMessageSquareOff, "duotone");
export const MessageCircle = icon("message-circle", HgMessageCircle, "duotone");
export const MessageCircleIcon = icon("message-circle", HgMessageCircle, "duotone");
export const MessageCircleQuestionIcon = icon(
  "message-circle-question",
  HgMessageCircleQuestionMark,
  "duotone",
);
export const EllipsisIcon = icon("ellipsis", HgEllipsis, "bold");
export const MoreHorizontalIcon = EllipsisIcon;
export const MoreVertical = icon("more-vertical", HgMoreVertical, "bold");
export const PlayIcon = icon("play", HgPlay, "duotone");
export const Play = PlayIcon;
export const ListChecksIcon = icon("list-checks", HgListChecks, "duotone");
export const ListTodoIcon = icon("list-todo", HgListTodo, "duotone");
export const ListFilterIcon = icon("list-filter", HgListFilter, "bold");
export const Camera = icon("camera", HgCamera, "duotone");
export const PaperclipIcon = icon("paperclip", HgPaperclip, "duotone");
export const SendIcon = icon("send", HgSend, "duotone");
export const UserPlusIcon = icon("user-plus", HgUserPlus, "duotone");
export const UsersIcon = icon("users", HgUsers, "duotone");
export const LayersIcon = icon("layers", HgLayers, "duotone");
export const PipetteIcon = icon("pipette", HgPipette, "duotone");
export const PaletteIcon = icon("palette", HgPalette, "duotone");
export const PaintbrushIcon = icon("paintbrush", HgPaintbrush, "duotone");
export const ScanIcon = icon("scan", HgScan, "bold");
export const FoldHorizontalIcon = icon("fold-horizontal", HgFoldHorizontal, "bold");
export const Grid2x2Icon = icon("grid-2x2", HgGrid2x2, "duotone");
export const Paintbrush = icon("paintbrush", HgPaintbrush, "duotone");
export const PencilRulerIcon = icon("pencil-ruler", HgPencilRuler, "duotone");
export const PenLineIcon = icon("pen-line", HgPenLine, "duotone");
export const PenLine = icon("pen-line", HgPenLine, "duotone");
export const SquarePenIcon = icon("square-pen", HgSquarePen, "duotone");
export const Frame = icon("frame", HgFrame, "duotone");
export const MousePointerClick = icon("mouse-pointer-click", HgMousePointerClick, "duotone");
export const MousePointerClickIcon = icon("mouse-pointer-click", HgMousePointerClick, "duotone");
export const MousePointer2 = icon("mouse-pointer-2", HgCursor01, "duotone");
export const MousePointer2Icon = icon("mouse-pointer-2", HgCursor01, "duotone");
export const Maximize2Icon = icon("maximize-2", HgArrowExpand01, "bold");
export const Minimize2Icon = icon("minimize-2", HgArrowShrink02, "bold");
export const PanelLeftIcon = icon("panel-left", HgPanelLeft, "duotone");
export const PanelLeftCloseIcon = icon("panel-left-close", HgPanelLeftClose, "duotone");
// The workspace panel toggles fill the half they control, so the pair reads as "this edge" /
// "that edge" at a glance (the design's half squares). The fill traces Hugeicons' own squircle.
const PanelRightHalf: IconSvgElement = [
  ...HgPanelRight,
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
  ...HgPanelBottom,
  [
    "path",
    {
      d: "M2.49219 12.0001C2.49219 16.4785 2.49219 18.7176 3.88343 20.1089C5.27467 21.5001 7.51384 21.5001 11.9922 21.5001C16.4705 21.5001 18.7097 21.5001 20.1009 20.1089C21.4922 18.7176 21.4922 16.4785 21.4922 12.0001V15.0001H2.49219V12.0001Z",
      fill: "currentColor",
      key: "half",
    },
  ],
];
export const PanelRightIcon = icon("panel-right", PanelRightHalf, "bold");
export const PanelBottomIcon = icon("panel-bottom", PanelBottomHalf, "bold");
export const PictureInPicture2 = icon("picture-in-picture-2", HgPictureInPicture, "duotone");
export const Columns2Icon = icon("columns-2", HgLayoutTwoColumn, "duotone");
export const Rows3Icon = icon("rows-3", HgRows3, "duotone");
export const SquareSplitHorizontal = icon(
  "square-split-horizontal",
  HgSquareSplitHorizontal,
  "duotone",
);
export const SquareSplitVertical = icon("square-split-vertical", HgSquareSplitVertical, "duotone");
export const TextWrapIcon = icon("text-wrap", HgTextWrap, "bold");
export const WrapTextIcon = icon("wrap-text", HgTextWrap, "bold");
export const PilcrowIcon = icon("pilcrow", HgPilcrow, "duotone");
export const BookOpenIcon = icon("book-open", HgBookOpen, "duotone");
export const MoonIcon = icon("moon", HgMoon02, "duotone");
export const SunIcon = icon("sun", HgSun, "duotone");
export const ChartNoAxesColumnIcon = icon("chart-no-axes-column", HgChartNoAxesColumn, "duotone");
export const Unlink2 = icon("unlink-2", HgUnlink, "duotone");
export const CloudDownloadIcon = icon("cloud-download", HgCloudDownload, "duotone");
export const PencilIcon = icon("pencil", HgPencil, "duotone");
export const CircleSlashIcon = icon("circle-slash", HgCircleSlash, "duotone");
export const SmilePlusIcon = icon("smile-plus", HgSmilePlus, "duotone");
export const TagIcon = icon("tag", HgTag, "duotone");
export const ShieldCheckIcon = icon("shield-check", HgShieldCheck, "duotone");
export const BlocksIcon = icon("blocks", HgBlocks, "duotone");
export const XCircleIcon = CircleXIcon;

export const PackageIcon = icon("package", HgPackage, "duotone");
export const PackagePlusIcon = DownloadIcon;
export const UserRoundIcon = icon("user-round", HgUserRound, "duotone");
export const Volume2 = icon("volume-2", HgVolumeHigh, "duotone");
export const VolumeOff = icon("volume-off", HgVolumeOff, "duotone");
export const SkipBackIcon = icon("skip-back", HgSkipBack, "duotone");
export const SkipForwardIcon = icon("skip-forward", HgSkipForward, "duotone");
export const ListMusicIcon = icon("list-music", HgListMusic, "duotone");
export const ShuffleIcon = icon("shuffle", HgShuffle, "duotone");
export const RepeatIcon = icon("repeat", HgRepeat, "duotone");
export const Repeat1Icon = icon("repeat-1", HgRepeatOne, "duotone");
export const Square = icon("square", HgSquare, "duotone");

export const TargetIcon = icon("target", HgTarget, "duotone");
export const MessageSquareTextIcon = icon("message-square-text", HgMessageSquareText, "duotone");
export const SquareIcon = icon("square", HgSquare, "duotone");
export const InboxIcon = icon("inbox", HgInbox, "duotone");

export const FileTextIcon = icon("file-text", HgFileText, "duotone");
export const FileSpreadsheetIcon = icon("file-spreadsheet", HgFileSpreadsheet, "duotone");
export const PresentationIcon = icon("presentation", HgPresentation, "duotone");
export const MailIcon = icon("mail", HgMail, "duotone");
export const ImageIcon = icon("image", HgImage, "duotone");
export const BrainIcon = icon("brain", HgBrain, "duotone");
export const CalendarArrowDownIcon = icon("calendar-arrow-down", HgCalendarArrowDown, "bold");
export const CalendarArrowUpIcon = icon("calendar-arrow-up", HgCalendarArrowUp, "bold");

// Fork-only glyphs with no lucide counterpart: the sidebar chrome's New agent
// and Usage rows (Figma 364:11246) and the thread card's blocked-on-you
// status mark (364:17299). Exported through the shim so every fork icon
// shares one weight policy and one `lucide` class prefix.
export const NavigationArrowIcon = icon("navigation-arrow", HgNavigation03, "duotone");
export const ChartDonutIcon = icon("chart-donut", HgChartRing, "duotone");
export const CircleHalfIcon = icon("circle-half", HgContrast, "fill");
export const FadersHorizontalIcon = icon("faders-horizontal", HgSlidersHorizontal, "duotone");
// The model picker's favourite toggle.
export const HeartIcon = icon("heart", HgHeart, "duotone");
export const EllipsisVerticalIcon = icon("ellipsis-vertical", HgEllipsisVertical, "bold");

export const ScaleIcon = icon("scale", HgScale, "duotone");
export const MicIcon = icon("mic", HgMic, "duotone");
export const MicOffIcon = icon("mic-off", HgMicOff, "duotone");
export const KeyRoundIcon = icon("key-round", HgKeyRound, "duotone");
export const LanguagesIcon = icon("languages", HgLanguages, "duotone");
export const AudioLinesIcon = icon("audio-lines", HgAudioLines, "duotone");
export const TypeIcon = icon("type", HgType, "duotone");
export const MessageSquarePlusIcon = icon("message-square-plus", HgMessageSquarePlus, "duotone");
export const EraserIcon = icon("eraser", HgEraser, "duotone");
export const ListTreeIcon = icon("list-tree", HgListTree, "duotone");
export const BuildingIcon = icon("building", HgBuilding, "duotone");
export const MessagesSquare = icon("messages-square", HgMessagesSquare, "duotone");
export const FolderTreeIcon = icon("folder-tree", HgFolderTree, "duotone");
export const BracesIcon = Braces;
export const CircuitBoardIcon = icon("circuit-board", HgCircuitBoard, "duotone");
export const CloudCogIcon = icon("cloud-cog", HgCloudCog, "duotone");
export const Code2Icon = icon("code-2", HgSourceCode, "duotone");
export const FolderCodeIcon = icon("folder-code", HgFolderCode, "duotone");
export const Gamepad2Icon = icon("gamepad-2", HgGamepad, "duotone");
export const Layers3Icon = icon("layers-3", HgLayers01, "duotone");
export const Layers3 = Layers3Icon;
export const MusicIcon = icon("music", HgMusic, "duotone");
export const YarnIcon = icon("yarn", HgSpool, "duotone");
export const ShoppingBagIcon = icon("shopping-bag", HgShoppingBag, "duotone");
export const VideoIcon = icon("video", HgVideo, "duotone");
export const ChevronLeft = ChevronLeftIcon;
export const QuoteIcon = icon("quote", HgQuote, "duotone");
export const TextIcon = icon("text", HgText, "duotone");
export const PanelsTopLeftIcon = icon("panels-top-left", HgPanelsTopLeft, "duotone");
export const TrendingDownIcon = icon("trending-down", HgTrendingDown, "bold");
export const TrendingUpIcon = icon("trending-up", HgTrendingUp, "bold");
export const TicketIcon = icon("ticket", HgTicket, "duotone");
export const SlidersHorizontalIcon = icon("sliders-horizontal", HgSlidersHorizontal, "duotone");
export const RocketIcon = icon("rocket", HgRocket, "duotone");
export const WorkflowIcon = icon("workflow", HgWorkflow, "duotone");
export const MessageSquareDashedIcon = icon(
  "message-square-dashed",
  HgMessageSquareDashed,
  "duotone",
);
export const CalendarIcon = icon("calendar", HgCalendar, "duotone");
export const Smartphone = SmartphoneIcon;
export const CircleArrowUpIcon = ArrowUpCircleIcon;
export const ShieldIcon = icon("shield", HgShield, "duotone");
export const ShieldOffIcon = icon("shield-off", HgShieldOff, "duotone");
export const FlaskConicalOffIcon = icon("flask-conical-off", HgFlaskConicalOff, "duotone");
export const UserIcon = icon("user", HgUser, "duotone");
export const CircleStopIcon = icon("circle-stop", HgStopCircle, "duotone");
export const PauseIcon = icon("pause", HgPause, "duotone");
export const MaximizeIcon = icon("maximize", HgFullScreen, "bold");
export const CircleDotDashedIcon = icon("circle-dot-dashed", HgCircleDotDashed, "duotone");
export const ShieldQuestionIcon = icon("shield-question", HgShieldQuestionMark, "duotone");
export const SquareArrowOutUpRightIcon = ExternalLinkIcon;
export const FilmIcon = icon("film", HgFilm, "duotone");
export const Home = icon("home", HgHome, "duotone");
export const Keyboard = KeyboardIcon;
export const Box = icon("box", HgBox, "duotone");
export const Maximize = icon("maximize", HgFullScreen, "bold");
export const Moon = MoonIcon;
export const MoreHorizontal = MoreHorizontalIcon;
export const Power = icon("power", HgPower, "bold");
export const SlidersHorizontal = SlidersHorizontalIcon;
export const Sun = SunIcon;
export const Type = icon("type", HgType, "duotone");
export const CircleAlert = CircleAlertIcon;
export const Table2 = icon("table-2", HgTable, "duotone");
export const GitPullRequestArrowIcon = GitPullRequestIcon;
export const Unlink2Icon = Unlink2;
export const UserCheckIcon = icon("user-check", HgUserCheck, "duotone");
export const UserRoundXIcon = icon("user-round-x", HgUserRoundX, "duotone");
export const Plug2Icon = icon("plug-2", HgPlug, "duotone");
export const PlugIcon = icon("plug", HgPlug, "duotone");
export const Volume2Icon = Volume2;
export const VolumeOffIcon = VolumeOff;
export const ReplyIcon = icon("reply", HgReply, "duotone");
export const ListPlusIcon = icon("list-plus", HgListPlus, "duotone");
export const Table2Icon = Table2;
export const ScrollTextIcon = icon("scroll-text", HgScrollText, "duotone");
export const OctagonXIcon = icon("octagon-x", HgOctagonX, "duotone");
export const UnlinkIcon = icon("unlink", HgUnlink, "duotone");
export const UserLockIcon = icon("user-lock", HgUserLock, "duotone");

/**
 * lucide's escape hatch for one-off glyphs drawn from path data (upstream's
 * settings snap-shot entry uses it). There is no Hugeicons counterpart to swap
 * in, so this renders the lucide node list verbatim with lucide's default
 * stroke attributes, under the same class contract as the table above.
 */
type LucideIconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;
export function createLucideIcon(lucideName: string, iconNode: LucideIconNode): LucideIcon {
  const lucideClasses = `lucide lucide-${lucideName}`;
  const Drawn: LucideIcon = ({
    className,
    size,
    weight: _weight,
    mirrored: _mirrored,
    alt,
    ...props
  }) => (
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
