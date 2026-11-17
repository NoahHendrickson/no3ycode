import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveBotDigestLinks } from "./botDigestItemLinks";
import { parseBotDigest } from "./botDigestSections";

const environmentId = EnvironmentId.make("env-1");
const SNAPSHOT = { state: "open", title: "Fix billing", isDraft: true };

function shell(id: string, fields: Partial<EnvironmentThreadShell>): EnvironmentThreadShell {
  return {
    id,
    environmentId,
    pullRequests: [],
    branchPullRequest: null,
    ...fields,
  } as unknown as EnvironmentThreadShell;
}

function linksOf(line: string, shells: ReadonlyArray<EnvironmentThreadShell>) {
  const item = parseBotDigest(`## New\n- ${line}\n`)[0]?.items[0];
  if (item === undefined) throw new Error("no item");
  return resolveBotDigestLinks(item, shells, environmentId);
}

describe("resolveBotDigestLinks", () => {
  it("lists a deep link to a thread's pull request once, kept as written, with the thread's state", () => {
    const billing = shell("thread-1", {
      pullRequests: [
        { url: "https://github.com/acme/app/pull/77", number: 77, snapshot: SNAPSHOT },
      ],
    } as unknown as Partial<EnvironmentThreadShell>);
    const links = linksOf(
      "Merge it? [Fix billing](t3-thread://v2/env-1/thread-1) https://github.com/acme/app/pull/77/files#r9",
      [billing],
    );
    expect(links.threads).toEqual([
      {
        link: { environmentId: "env-1", threadId: "thread-1" },
        label: "Fix billing",
        shell: billing,
      },
    ]);
    expect(links.pullRequests).toEqual([
      {
        url: "https://github.com/acme/app/pull/77/files#r9",
        number: 77,
        snapshot: SNAPSHOT,
        branch: null,
        thread: billing,
      },
    ]);
  });

  it("names a thread it cannot find by its label, and one thread written two ways once", () => {
    const billing = shell("thread-1", {});
    const links = linksOf(
      "Ship it? [Fix billing](t3-thread://v1/thread-1) <t3-thread://v2/env-1/thread-1> [Old work](t3-thread://v2/env-1/gone)",
      [billing],
    );
    expect(
      links.threads.map(({ label, shell }) => ({ label, found: shell !== undefined })),
    ).toEqual([
      { label: "Fix billing", found: true },
      { label: "Old work", found: false },
    ]);
  });

  it("adds a linked thread's branch pull request when it has no linked one", () => {
    const branch = { url: "https://github.com/acme/app/pull/5", number: 5, repository: "acme/app" };
    const docs = shell("thread-2", {
      branchPullRequest: branch,
    } as unknown as Partial<EnvironmentThreadShell>);
    const links = linksOf("Docs are ready. <t3-thread://v2/env-1/thread-2>", [docs]);
    expect(links.pullRequests).toEqual([
      { url: branch.url, number: 5, snapshot: null, branch, thread: docs },
    ]);
  });
});
