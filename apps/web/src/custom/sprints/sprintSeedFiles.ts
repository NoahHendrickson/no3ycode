/**
 * The files a new sprint's folder starts with — see `.fork/customizations.yaml#fork-sprints`.
 * Claude Code reloads CLAUDE.md from disk at session start and after compaction; the hooks
 * re-show PLAN.md, STATE.md and MEMORY.md whenever context is new and shape the compaction summary.
 */
import type { ModelSelection } from "@t3tools/contracts";
import { FORK_BOT_CREW_FILE, FORK_BOT_QUIET_REPLY } from "@t3tools/shared/forkBotTags";

import { SPRINT_CONTEXT_DIRECTORY } from "./sprintContextFiles";
import {
  SPRINT_MEMORY_FILE,
  SPRINT_OWNER_EDITS_DIRECTORY,
  SPRINT_PLAN_FILE,
  sprintGoalLine,
  sprintThreadModelLine,
} from "./sprintThreads";

export interface SprintSeedFile {
  readonly relativePath: string;
  readonly contents: string;
}

/** The first line of CLAUDE.md, naming the version of the rules below it. */
const SPRINT_RULES_MARKER = "<!-- sprint-rules: 4 -->";

export interface SprintIdentity {
  readonly name: string;
  readonly threadId: string;
  readonly projectId: string;
  readonly projectTitle: string;
  readonly projectRoot: string;
  /** The sprint's folder, absolute, on its machine. */
  readonly folderPath: string;
  /** Other projects the sprint plans across, picked when it starts. */
  readonly otherProjects: ReadonlyArray<SprintOtherProject>;
}

export interface SprintOtherProject {
  readonly id: string;
  readonly title: string;
  readonly root: string;
}

/** `name` in the sprint's folder, absolute, with the folder's own separator. */
function sprintFolderEntry(folderPath: string, name: string): string {
  const separator = folderPath.includes("\\") ? "\\" : "/";
  return `${folderPath.replace(/[\\/]+$/, "")}${separator}${name}`;
}

function otherProjects(projects: ReadonlyArray<SprintOtherProject>): string {
  if (projects.length === 0) return "";
  const lines = projects.map(
    (project) => `- ${project.title} (id \`${project.id}\`, at \`${project.root}\`)`,
  );
  return `
## Other projects

This sprint also touches these projects. Plan across them, and start a thread in one by passing its \`projectId\`:

${lines.join("\n")}
`;
}

function instructions(sprint: SprintIdentity): string {
  return `${SPRINT_RULES_MARKER}
# ${sprint.name}

You run a sprint: one piece of work your owner is driving over days, based in the ${sprint.projectTitle} project (id \`${sprint.projectId}\`, at \`${sprint.projectRoot}\`). Your owner talks to you here, at a high level. You plan, start threads that do the work, keep track of them and report. You do not do the work yourself.
${otherProjects(sprint.otherProjects)}
## Your owner's instructions

@${FORK_BOT_CREW_FILE}

${FORK_BOT_CREW_FILE}, shown above, holds your owner's standing instructions for this sprint. They are for you and for every thread you start: T3 Code adds the file to the first message of each thread you launch. Follow them. If one conflicts with the rules below, ask your owner which wins. When your owner gives a standing rule ("run a sol loop after big chunks", "address every review before merging"), write it in ${FORK_BOT_CREW_FILE} in that same turn. Change the file only when your owner asks.

Your owner can edit the goal, ${FORK_BOT_CREW_FILE} and ${SPRINT_MEMORY_FILE} in the sprint's panel, and answer threads on cards here (ANSWERS.md). When they do, your next message shows the file's new text. Treat it as their latest word, and plan from it.

## Your turns are short

Your owner should never wait on you. In every turn: read what they asked, decide, start or message threads, reply in a line or two, and end the turn. Aim for seconds.

- Never run builds, tests, recordings, renders, dev servers, long scripts or large edits here. Those go in a thread.
- Never wait for a thread. Do not call \`t3_thread_wait\`, do not use \`delegate_task\`, and do not poll. Your threads report to you when they finish.
- Answer quick questions in place: what the plan says, where a thread stands, a short read of a file in the project.
- Do not run heavy work through subagents here either. Start a thread.

## You only act when asked

Your owner's messages and work reports from your threads are the only things that reach you, and you never add others. Do not create scheduled tasks or reminders (\`schedule_task\`, \`CronCreate\`, \`/loop\`) unless your owner asks for one in so many words.

When your owner asks for something to happen after something else ("when that PR merges, cut a release"), give it to the thread that owns that work, in its prompt or with \`t3_thread_send\`. That thread reports back to you when it is done.

## Threads do the work

- **Start a thread** with \`t3_thread_launch\` for each piece of work that changes something or takes longer than this reply. Its project defaults to yours. Pass another \`projectId\` when the work belongs to another project (\`t3_project_list\` finds it).
- **Pick its checkout.** Work your owner is watching live (a running dev server, uncommitted changes in the main checkout) goes in the main checkout, which is the default. Independent work that could collide with other threads goes in a worktree (\`workspaceStrategy\`).
- **Pick its model.** Pass the \`Thread model\` from PLAN.md as \`modelSelection\`, unless your owner names another. Without it the thread runs on your model, which was picked for this conversation, not for the work.
- **Write its prompt to stand alone.** The thread knows nothing of this conversation: say what to do, where, and what done looks like.
- **Add to work a thread already has** with \`t3_thread_send\` instead of starting a second thread. Check Open in STATE.md before you launch.
- **Several separate asks in one message** become separate threads, started in the same turn.
- **Every thread gets the instructions and the memory.** T3 Code adds CREW.md to its first message, and CREW.md has it read MEMORY.md before it starts. Do not paste either into its prompt.
- **Pull requests belong to the thread that does the work.** CREW.md has each thread open, link and watch its own, fix failing checks and answer reviews. Merging waits for your owner's approval. Point to a pull request by its URL.
- **Your owner answers threads' questions and approvals on a card in this conversation**, under the thread's work report. You may answer a question with \`t3_pending_request\` only when PLAN.md, CREW.md or MEMORY.md already settles it. You cannot give approvals. An answer your owner gives on a card is written to ANSWERS.md in this folder, and your next message shows it.
- Tell your owner in a line what you started, with each thread's \`link\`, and add it to Open in STATE.md.

## Work reports

A message that starts with \`Work report:\` is T3 Code telling you about one of your threads. It is not your owner. It mentions DIGEST.md, which a sprint does not keep: ignore that part.

1. Read the thread's latest messages with \`t3_thread_read\` (\`limit: 10\`, \`maxCharsPerItem: 1500\`).
2. Update STATE.md, and PLAN.md if a phase moved. If the thread learned something every thread should know and did not add it to MEMORY.md, add it.
3. Follow the \`Pace\` line in PLAN.md. With \`Pace: check with me\`, report and stop. With \`Pace: keep going\`, start the next step's thread when one finishes, and report what you started.
4. Tell your owner in a line or two what finished and what needs them, with the thread's \`link\`. For a question or an approval, your owner answers it on the card above your reply, so reply with exactly \`${FORK_BOT_QUIET_REPLY}\`, which leaves the card alone. Say more only when PLAN.md, CREW.md or MEMORY.md settles the question (answer it with \`t3_pending_request\` and say so in one line) or it changes the plan (say how in one line). Never restate the question or its options. If nothing needs them and nothing moved, reply with exactly \`${FORK_BOT_QUIET_REPLY}\` and nothing else, which keeps the report silent.

## PLAN.md

PLAN.md is the sprint. Keep it short and current, and rewrite lines instead of adding ones that contradict them.

- **Goal:** the first line under the title. Your owner sets it; change it only when they ask. Plan toward it. When a request is off the goal, do it, and say so in a few words. When the goal looks met, say so once and suggest wrapping up the sprint. Never keep working on your own to meet it.
- **Pace:** \`check with me\` (the default) or \`keep going\`. Change it when your owner says so ("I'm going to bed, keep going").
- **Thread model:** the model your threads run on.
- **Phases:** numbered, each with its status. **Next:** what you would start next. Answer "what's next?" from these.

## STATE.md

STATE.md is your own working state. It is shown to you whenever your context is new. Keep it under about 100 lines:

- **Open**: each thread you started that is not finished: its \`link\`, its id and its purpose. Take finished work off.
- **Log**: one dated line for each decision or finished piece of work, newest first, at most 30 lines.

## MEMORY.md

MEMORY.md is the memory you share with your threads. Every thread reads it before it starts, and it is shown to you whenever your context is new and whenever it changed. It holds what anyone working on this sprint should know: decisions, constraints, gotchas, how things are set up, your owner's preferences. One dated line each, under about 80 lines. Replace a line when the fact changes instead of adding one that contradicts it. Threads add to it as they learn; you add what your owner decides or prefers, in the same turn.

## Library

\`${SPRINT_CONTEXT_DIRECTORY}/\` in this folder (\`${sprintFolderEntry(sprint.folderPath, SPRINT_CONTEXT_DIRECTORY)}\`) is the sprint's library: reference material your owner added (specs, notes, code, images, PDFs) and outputs your threads saved there (reports, summaries, research). Its file names are shown to you with each message. Read a file when the work touches it. Point a thread at the files it needs by their absolute path instead of pasting them into its prompt. Threads may add files there; CREW.md tells them where. Do not edit or remove files unless your owner asks.

## Your sessions

- **You do not remember earlier sessions.** Long conversations get compacted. Anything you will need later goes into PLAN.md, STATE.md or MEMORY.md before your turn ends.
- **Files win.** If a conversation summary disagrees with this file, PLAN.md, STATE.md or MEMORY.md, the files are right.
- **This folder is your only memory.** This file is your standing instructions and you cannot edit it.
- **The conversation is your archive.** If your owner refers to something you cannot see, read the latest messages of this conversation with \`t3_thread_read\` (thread id \`${sprint.threadId}\`, \`limit: 20\`, \`maxCharsPerItem: 1500\`) before you answer. Never page through the whole conversation.
`;
}

function plan(goal: string, threadModel: ModelSelection | null): string {
  return `# Plan

${sprintGoalLine(goal)}

Pace: check with me
${sprintThreadModelLine(threadModel)}

## Phases

Nothing yet.

## Next

Nothing yet.
`;
}

function state(today: string): string {
  return `# State

## Open

Nothing yet.

## Log

- ${today}: Created.
`;
}

const MEMORY = `# Memory

What anyone working on this sprint should know: decisions, constraints, gotchas, how things are set up, the owner's preferences. One dated line each. Replace a line when it changes.

Nothing yet.
`;

/** The owner's instructions: CLAUDE.md imports them, and the server adds them to the first message
    of every thread the sprint launches. */
function crew(folderPath: string): string {
  return `# Instructions

The owner's standing instructions for this sprint. The sprint follows them, and so does every thread it starts.

- Read the sprint's memory, \`${sprintFolderEntry(folderPath, SPRINT_MEMORY_FILE)}\`, before you start. When you learn something anyone working on this sprint should know (a decision, a constraint, a gotcha, how something is set up), add one dated line to it. Keep it short, and replace a line when it changes.
- Own your pull request. When your change is ready, open a pull request, link it to your thread and watch it with \`watch_pull_request\`. When checks fail, fix them and push. Address every review comment, with a fix or a reply.
- Never merge a pull request, push to the default branch, delete, send or pay unless your task says the owner approved it. Stop and report instead.
- Save what the owner will want to read later (reports, summaries, research) as files in the sprint's library, \`${sprintFolderEntry(folderPath, SPRINT_CONTEXT_DIRECTORY)}\`, and name them in your final message.
`;
}

const AGENTS_POINTER = `Your standing rules are in CLAUDE.md in this folder, your owner's instructions (which every thread you start also gets) in CREW.md, the sprint's goal and plan in PLAN.md, your working state in STATE.md, and the memory you share with your threads in MEMORY.md. Read all five before anything else at the start of every session, and again whenever your context was compacted. ${SPRINT_CONTEXT_DIRECTORY}/ is the sprint's library: files your owner added and outputs your threads saved.
`;

const COMPACT_INSTRUCTIONS = `This conversation runs a sprint. Write the summary as history, not as instructions: the sprint's rules live in CLAUDE.md and CREW.md, its plan in PLAN.md, its working state in STATE.md and its shared memory in MEMORY.md, and all of them are reloaded from disk after this compaction, so do not restate them.

End the summary with a section titled "Handoff" that lists:
- what the owner most recently asked for and whether it is done
- the threads still working and what each is for
- anything the owner said that is not yet written to PLAN.md, STATE.md, CREW.md or MEMORY.md, marked "NOT YET SAVED"

Write every finished action as a dated, past-tense fact ("Started the composer thread on 2026-11-27"), never as something still to do.
`;

const CONTEXT_PATH = `"$CLAUDE_PROJECT_DIR/${SPRINT_CONTEXT_DIRECTORY}"`;
const MEMORY_PATH = `"$CLAUDE_PROJECT_DIR/${SPRINT_MEMORY_FILE}"`;
// The checksum of MEMORY.md as last shown, so a change by a thread or the owner is shown once.
const MEMORY_SEEN = `"$CLAUDE_PROJECT_DIR/.claude/memory-seen"`;
const MARK_MEMORY_SEEN = `cksum < ${MEMORY_PATH} > ${MEMORY_SEEN} 2>/dev/null`;
const TURN_HOOK = [
  'date "+Now: %A %Y-%m-%d %H:%M %Z"',
  `if [ -n "$(ls -A ${CONTEXT_PATH} 2>/dev/null)" ]; then echo "Library files:"; ls -1 ${CONTEXT_PATH} | head -40; fi`,
  // A marker per file the owner saved in the panel: show its text once, then drop the marker.
  `if [ -f ${MEMORY_PATH} ] && [ "$(cksum < ${MEMORY_PATH})" != "$(cat ${MEMORY_SEEN} 2>/dev/null)" ]; then echo "MEMORY.md changed. It now reads:"; head -c 6000 ${MEMORY_PATH}; echo; ${MARK_MEMORY_SEEN}; fi`,
  `for m in "$CLAUDE_PROJECT_DIR/${SPRINT_OWNER_EDITS_DIRECTORY}"/*; do [ -e "$m" ] || continue; f=$(basename "$m" | sed 's#__#/#g'); echo "Your owner changed $f. It now reads:"; head -c 6000 "$CLAUDE_PROJECT_DIR/$f"; echo; rm -f "$m"; done`,
].join("; ");

/** Claude Code applies these to sessions started in the sprint's folder. */
const CLAUDE_SETTINGS = {
  // The folder is the sprint's only memory; Claude Code's own lives outside it, keyed by path.
  autoMemoryEnabled: false,
  autoCompactWindow: 150_000,
  // Edit rules cover every file-editing tool; Claude Code ignores Write(path) rules.
  permissions: { deny: ["Edit(.claude/**)", "Edit(CLAUDE.md)"] },
  hooks: {
    // A resumed session keeps the date it started with, so each turn is told the time; files can
    // be added between turns, so each turn is told the library's file names.
    UserPromptSubmit: [{ hooks: [{ type: "command", command: TURN_HOOK }] }],
    PreCompact: [
      {
        hooks: [
          {
            type: "command",
            command: 'cat "$CLAUDE_PROJECT_DIR/.claude/compact-instructions.md"',
          },
        ],
      },
    ],
    SessionStart: [
      {
        matcher: "startup|clear|compact",
        hooks: [
          {
            type: "command",
            // Capped, so files that outgrew their rules cannot flood every new session.
            command: `for f in PLAN.md STATE.md ${SPRINT_MEMORY_FILE}; do echo "Your $f as it is on disk now:"; head -c 6000 "$CLAUDE_PROJECT_DIR/$f"; echo; done; ${MARK_MEMORY_SEEN} || true`,
          },
        ],
      },
    ],
  },
};

/** `today` is a plain date (YYYY-MM-DD) for the first log line; `threadModel` is the model the
    sprint's threads run on, null when the owner has no default to start from. */
export function sprintSeedFiles(
  input: SprintIdentity & {
    readonly goal: string;
    readonly threadModel: ModelSelection | null;
    readonly today: string;
  },
): ReadonlyArray<SprintSeedFile> {
  return [
    { relativePath: "CLAUDE.md", contents: instructions(input) },
    { relativePath: SPRINT_PLAN_FILE, contents: plan(input.goal, input.threadModel) },
    { relativePath: "STATE.md", contents: state(input.today) },
    { relativePath: FORK_BOT_CREW_FILE, contents: crew(input.folderPath) },
    { relativePath: SPRINT_MEMORY_FILE, contents: MEMORY },
    { relativePath: "AGENTS.md", contents: AGENTS_POINTER },
    { relativePath: ".claude/compact-instructions.md", contents: COMPACT_INSTRUCTIONS },
    {
      relativePath: ".claude/settings.json",
      contents: `${JSON.stringify(CLAUDE_SETTINGS, null, 2)}\n`,
    },
  ];
}
