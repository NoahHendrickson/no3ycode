import { type RepositoryIdentity, SourceControlProviderKind } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { projectBranchUrl, refBranchUrl } from "./branchLinks";

const identity = (
  provider: string,
  canonicalKey: string,
  remoteUrl: string,
  extra: Partial<RepositoryIdentity> = {},
): RepositoryIdentity => ({
  canonicalKey,
  provider: SourceControlProviderKind.make(provider),
  locator: { source: "git-remote", remoteName: "origin", remoteUrl },
  ...extra,
});

const github = identity("github", "github.com/acme/app", "git@github.com:acme/app.git");

describe("projectBranchUrl", () => {
  it.each([
    [github, "https://github.com/acme/app/tree/main"],
    [
      identity("gitcafe", "git.cafe/acme/app", "git@git.cafe:acme/app.git"),
      "https://git.cafe/acme/app/tree/main",
    ],
    [
      identity("gitlab", "gitlab.com/acme/platform/app", "git@gitlab.com:acme/platform/app.git"),
      "https://gitlab.com/acme/platform/app/-/tree/main",
    ],
    [
      identity("forgejo", "codeberg.org/acme/app", "git@codeberg.org:acme/app.git"),
      "https://codeberg.org/acme/app/src/branch/main",
    ],
    [
      identity("bitbucket", "bitbucket.org/acme/app", "git@bitbucket.org:acme/app.git"),
      "https://bitbucket.org/acme/app/branch/main",
    ],
    [
      identity(
        "azure-devops",
        "dev.azure.com/org/project/_git/app",
        "https://dev.azure.com/org/project/_git/app",
      ),
      "https://dev.azure.com/org/project/_git/app?version=GBmain",
    ],
  ])("builds %#'s branch page", (project, expected) => {
    expect(projectBranchUrl(project, "main")).toBe(expected);
  });

  it("encodes each segment of a nested branch but keeps its slashes", () => {
    expect(projectBranchUrl(github, "feature/a b#1")).toBe(
      "https://github.com/acme/app/tree/feature/a%20b%231",
    );
    expect(
      projectBranchUrl(
        identity(
          "azure-devops",
          "dev.azure.com/org/project/_git/app",
          "https://dev.azure.com/org/project/_git/app",
        ),
        "feature/x",
      ),
    ).toBe("https://dev.azure.com/org/project/_git/app?version=GBfeature%2Fx");
  });

  it("builds under a webUrl's mount path and an HTTP remote's port", () => {
    expect(
      projectBranchUrl(
        identity("gitlab", "git.example.com/acme/app", "git@git.example.com:acme/app.git", {
          webUrl: "https://git.example.com/gitlab/acme/app",
        }),
        "feature/x",
      ),
    ).toBe("https://git.example.com/gitlab/acme/app/-/tree/feature/x");
    expect(
      projectBranchUrl(
        identity("forgejo", "git.local:3000/acme/app", "http://git.local:3000/acme/app.git"),
        "main",
      ),
    ).toBe("http://git.local:3000/acme/app/src/branch/main");
  });

  it("builds an SSH-cloned Azure repository at its web spelling", () => {
    expect(
      projectBranchUrl(
        identity(
          "azure-devops",
          "ssh.dev.azure.com/v3/org/project/app",
          "git@ssh.dev.azure.com:v3/org/project/app",
        ),
        "main",
      ),
    ).toBe("https://dev.azure.com/org/project/_git/app?version=GBmain");
  });

  it("builds nothing for an unknown host, a host without branch pages, or no branch", () => {
    expect(projectBranchUrl(null, "main")).toBeNull();
    expect(
      projectBranchUrl(identity("unknown", "example.com/acme/app", "git@example.com:a/b"), "main"),
    ).toBeNull();
    expect(
      projectBranchUrl(
        identity("cursor-origin", "origin.cursor.com/acme/app", "https://origin.cursor.com/a/b"),
        "main",
      ),
    ).toBeNull();
    const { provider: _provider, ...withoutProvider } = github;
    expect(projectBranchUrl(withoutProvider, "main")).toBeNull();
    expect(projectBranchUrl(github, "  ")).toBeNull();
  });
});

describe("refBranchUrl", () => {
  it("links a remote ref of the project's own remote at its branch name", () => {
    expect(
      refBranchUrl(
        github,
        { name: "origin/feature/x", isRemote: true, remoteName: "origin" },
        null,
      ),
    ).toBe("https://github.com/acme/app/tree/feature/x");
    expect(
      refBranchUrl(github, { name: "fork/feature", isRemote: true, remoteName: "fork" }, null),
    ).toBeNull();
  });

  it("does not link the checked-out branch while git reports no upstream", () => {
    const status = { refName: "feature", hasUpstream: false };
    expect(refBranchUrl(github, { name: "feature" }, status)).toBeNull();
    expect(refBranchUrl(github, { name: "main" }, status)).toBe(
      "https://github.com/acme/app/tree/main",
    );
  });
});
