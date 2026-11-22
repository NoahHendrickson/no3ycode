/**
 * A branch's page on the project's source control host — see
 * `.fork/customizations.yaml#fork-branch-link-copy`.
 */
import { projectCommitUrl } from "@t3tools/client-runtime/change-request-links";
import type { RepositoryIdentity, VcsRef } from "@t3tools/contracts";

/** `branch: null` is Azure DevOps, which names the branch in `?version=GB<name>`. */
const BRANCH_ROUTES: Readonly<
  Record<string, { readonly commit: string; readonly branch: string | null }>
> = {
  github: { commit: "commit", branch: "tree" },
  gitcafe: { commit: "commit", branch: "tree" },
  gitlab: { commit: "-/commit", branch: "-/tree" },
  forgejo: { commit: "commit", branch: "src/branch" },
  bitbucket: { commit: "commits", branch: "branch" },
  "azure-devops": { commit: "commit", branch: null },
};

// The repository's web root comes from the host's own commit link, so webUrl mounts, HTTP remote
// ports and Azure's SSH spellings resolve exactly as they do for commits.
const PROBE_SHA = "0".repeat(40);

function branchUrlOn(identity: RepositoryIdentity | undefined, branch: string): string | null {
  const route = identity?.provider === undefined ? undefined : BRANCH_ROUTES[identity.provider];
  const name = branch.trim();
  if (route === undefined || name.length === 0) return null;
  const commitUrl = projectCommitUrl(identity, PROBE_SHA);
  if (commitUrl === null) return null;
  const url = new URL(commitUrl);
  const suffix = `/${route.commit}/${PROBE_SHA}`;
  if (!url.pathname.endsWith(suffix)) return null;
  const repository = url.pathname.slice(0, -suffix.length);
  if (route.branch === null) {
    url.pathname = repository;
    url.search = `?version=GB${encodeURIComponent(name)}`;
  } else if (identity?.provider === "gitcafe" && name.includes("/")) {
    // GitCafe reads the revision as one segment, so a slash in the name must not split it.
    url.pathname = `${repository}/${route.branch}/${encodeURIComponent(`refs/heads/${name}`)}`;
  } else {
    const segments = name.split("/").map(encodeURIComponent).join("/");
    url.pathname = `${repository}/${route.branch}/${segments}`;
  }
  return url.toString();
}

/** In a fork checkout the identity is `upstream`; branches are pushed to `origin` on the same host. */
function pushIdentity(identity: RepositoryIdentity): RepositoryIdentity {
  const origin = identity.origin;
  if (origin?.remoteUrl === undefined) return identity;
  if (origin.canonicalKey.split("/")[0] !== identity.canonicalKey.split("/")[0]) return identity;
  const { webUrl: _upstreamWebUrl, ...rest } = identity;
  return {
    ...rest,
    canonicalKey: origin.canonicalKey,
    locator: { ...identity.locator, remoteName: "origin", remoteUrl: origin.remoteUrl },
  };
}

/** The page of a local branch, on the remote it is pushed to. */
export function projectBranchUrl(
  identity: RepositoryIdentity | null | undefined,
  branch: string,
): string | null {
  return identity == null ? null : branchUrlOn(pushIdentity(identity), branch);
}

/** The link for a ref the branch picker lists: a remote ref on the project's own remote or origin. */
export function refBranchUrl(
  identity: RepositoryIdentity | null | undefined,
  ref: Pick<VcsRef, "name" | "isRemote" | "remoteName">,
): string | null {
  if (identity == null) return null;
  if (ref.isRemote !== true) return projectBranchUrl(identity, ref.name);
  for (const target of [identity, pushIdentity(identity)]) {
    const prefix = `${target.locator.remoteName}/`;
    if (ref.remoteName === target.locator.remoteName && ref.name.startsWith(prefix)) {
      return branchUrlOn(target, ref.name.slice(prefix.length));
    }
  }
  return null;
}
