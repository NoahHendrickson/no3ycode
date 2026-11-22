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

export function projectBranchUrl(
  identity: RepositoryIdentity | null | undefined,
  branch: string,
): string | null {
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
  } else {
    const segments = name.split("/").map(encodeURIComponent).join("/");
    url.pathname = `${repository}/${route.branch}/${segments}`;
  }
  return url.toString();
}

/**
 * The link for a ref the branch picker lists. A remote ref links only when it tracks the project's
 * own remote, and a checked-out branch git reports without an upstream has no page yet.
 */
export function refBranchUrl(
  identity: RepositoryIdentity | null | undefined,
  ref: Pick<VcsRef, "name" | "isRemote" | "remoteName">,
  status: { readonly refName: string | null; readonly hasUpstream: boolean } | null | undefined,
): string | null {
  if (identity == null) return null;
  if (ref.isRemote === true) {
    const prefix = `${identity.locator.remoteName}/`;
    return ref.remoteName === identity.locator.remoteName && ref.name.startsWith(prefix)
      ? projectBranchUrl(identity, ref.name.slice(prefix.length))
      : null;
  }
  if (status?.refName === ref.name && !status.hasUpstream) return null;
  return projectBranchUrl(identity, ref.name);
}
