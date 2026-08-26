import type {
  GdocSnapshot,
  JiraIssueSnapshot,
  JiraProjectSnapshot,
  LinkWithStatus,
  PrSnapshot,
  Project,
  RepoScopeSnapshot,
} from "@workboard/core";
import { ciLabel, DocMark, GitHubMark, JiraMark } from "./chips";
import { TimeAgo } from "./time-ago";
import { addLinkAction, deleteLinkAction } from "@/lib/actions";

import { fieldCls as inputCls, primaryButtonCls as btnCls } from "./form";

/** One line of live state per link kind — what the last sync found. */
export function LinkSnapshot({ link }: { link: LinkWithStatus }) {
  const data = link.snapshot?.data as
    | PrSnapshot
    | RepoScopeSnapshot
    | JiraProjectSnapshot
    | JiraIssueSnapshot
    | GdocSnapshot
    | { type?: string }
    | undefined;
  if (!data || typeof data !== "object" || !("type" in data)) return null;
  if (data.type === "pr") {
    const pr = data as PrSnapshot;
    const state = pr.merged
      ? "merged"
      : pr.state === "closed"
        ? "closed"
        : pr.draft
          ? "draft"
          : (pr.reviewDecision ?? "open").replace("_", " ");
    // CI is only shown for in-flight PRs — closed/merged never carry it
    return (
      <span className="text-meta text-muted">
        #{pr.number} · {state}
        {pr.state === "open" && ciLabel(pr.ciStatus) && (
          <span className={pr.ciStatus === "failing" ? "font-semibold text-critical" : pr.ciStatus === "passing" ? "text-good" : ""}>
            {" "}
            · {ciLabel(pr.ciStatus)}
          </span>
        )}{" "}
        · updated <TimeAgo at={pr.updatedAt} />
      </span>
    );
  }
  if (data.type === "repo") {
    const repo = data as RepoScopeSnapshot;
    const open = repo.prs.filter((p) => p.state === "open");
    const failing = open.filter((p) => p.ciStatus === "failing").length;
    return (
      <span className="text-meta text-muted">
        {open.length} open PR{open.length === 1 ? "" : "s"} in scope · {repo.prs.length} tracked
        {failing > 0 && <span className="font-semibold text-critical"> · {failing} CI failing</span>}
      </span>
    );
  }
  if (data.type === "jira_project") {
    const jp = data as JiraProjectSnapshot;
    return (
      <span className="text-meta text-muted">
        {Object.entries(jp.byStatusCategory)
          .map(([k, v]) => `${v} ${k.toLowerCase()}`)
          .join(" · ")}
      </span>
    );
  }
  if (data.type === "jira_issue") {
    const ji = data as JiraIssueSnapshot;
    return (
      <span className="text-meta text-muted">
        {ji.status}
        {ji.assignee ? ` · ${ji.assignee}` : ""} · updated <TimeAgo at={ji.updatedAt} />
      </span>
    );
  }
  if (data.type === "gdoc") {
    const doc = data as GdocSnapshot;
    return (
      <span className="text-meta text-muted">
        edited <TimeAgo at={doc.modifiedAt} />
      </span>
    );
  }
  return null;
}

export function ProviderMark({ provider }: { provider: string }) {
  if (provider === "github") return <GitHubMark />;
  if (provider === "jira") return <JiraMark />;
  if (provider === "gdoc") return <DocMark />;
  return <span className="size-3 rounded-full border border-hairline" aria-hidden />;
}

export function LinksPanel({ links, project }: { links: LinkWithStatus[]; project: Project }) {
  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 ? (
        <p className="text-body text-muted">Nothing linked yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {links.map((link) => (
            <li key={link.id} className="group flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <ProviderMark provider={link.provider} />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-body text-ink-2 hover:text-accent hover:underline"
                >
                  {link.title || link.externalId || link.url}
                </a>
                <form action={deleteLinkAction} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
                  <input type="hidden" name="linkId" value={link.id} />
                  <input type="hidden" name="slug" value={project.slug} />
                  <button type="submit" aria-label="Remove link" className="text-muted hover:text-critical">
                    ×
                  </button>
                </form>
              </div>
              <div className="pl-5">
                <LinkSnapshot link={link} />
                {link.syncState?.lastError && (
                  <div className="text-meta font-medium text-critical">
                    ⚠ sync failing (<TimeAgo at={link.syncState.lastAttemptAt} />): {link.syncState.lastError.slice(0, 140)}
                    {link.syncState.lastSuccessAt && (
                      <span className="font-normal text-muted">
                        {" "}
                        — showing data from <TimeAgo at={link.syncState.lastSuccessAt} />
                      </span>
                    )}
                  </div>
                )}
                {!link.syncState?.lastError && link.snapshot && (
                  <div className="text-meta text-muted">
                    synced <TimeAgo at={link.snapshot.fetchedAt} />
                  </div>
                )}
                {link.kind === "repo" && link.scope && (
                  <div className="text-meta text-muted">
                    scope:{" "}
                    {[
                      link.scope.branchPrefix && `branch ${link.scope.branchPrefix}*`,
                      link.scope.pathPrefixes?.length && `paths ${link.scope.pathPrefixes.join(", ")}`,
                      link.scope.labels?.length && `labels ${link.scope.labels.join(", ")}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary className="cursor-pointer select-none text-meta text-accent hover:underline">+ Add link</summary>
        <form action={addLinkAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input name="url" placeholder="URL (GitHub PR/repo, Jira, Google Doc…)" className={inputCls} required />
          <input name="title" placeholder="Title (optional)" className={inputCls} />
          <p className="text-meta text-muted">Monorepo scope (repo links only, optional):</p>
          <input name="branchPrefix" placeholder="Branch prefix, e.g. payments-v2/" className={inputCls} />
          <input name="pathPrefixes" placeholder="Path prefixes, comma-separated" className={inputCls} />
          <input name="labels" placeholder="PR labels, comma-separated" className={inputCls} />
          <div>
            <button type="submit" className={btnCls}>
              Link
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
