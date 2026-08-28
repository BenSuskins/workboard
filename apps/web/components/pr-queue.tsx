"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "./avatar";
import { GitHubMark } from "./chips";
import {
  ACCENT_BG,
  ACCENT_TEXT,
  PR_BUCKET_LABEL,
  PR_BUCKET_TONE,
  tileAccent,
  tileGlyph,
} from "./labels";
import { PrRing } from "./state-glyphs";
import { checkDuration } from "../lib/format";
import type { PrBucket, PrLite, ProjectRef } from "../lib/pipeline";
import type { PrRow } from "../lib/prs";

/** One bucket's worth of the queue, already assigned and ordered on the server. */
export interface PrGroup {
  key: PrBucket;
  rows: PrRow[];
}

const COLLAPSED_KEY = "wb-prs-buckets";

/**
 * The queue itself. The data is a server component's job; what lives here is the
 * two things a reader changes — which buckets are folded away, and whether a red
 * PR is showing its checks.
 */
export function PrQueue({ groups }: { groups: PrGroup[] }) {
  // Open on the server and on the first paint, so nothing flashes shut on a cold
  // load; the effect below folds back whatever was folded last time.
  const [collapsed, setCollapsed] = useState<PrBucket[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[];
      setCollapsed(saved.filter((key): key is PrBucket => key in PR_BUCKET_TONE));
    } catch {
      setCollapsed([]);
    }
  }, []);

  const toggleBucket = useCallback((key: PrBucket) => {
    setCollapsed((previous) => {
      const next = previous.includes(key) ? previous.filter((k) => k !== key) : [...previous, key];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // A browser that refuses storage still gets the fold, just not the memory.
      }
      return next;
    });
  }, []);

  const toggleChecks = useCallback((id: string) => {
    setExpanded((previous) => (previous.includes(id) ? previous.filter((k) => k !== id) : [...previous, id]));
  }, []);

  return (
    <div className="flex max-w-[920px] flex-col gap-8">
      {groups.map((group) => {
        const open = !collapsed.includes(group.key);
        const tone = PR_BUCKET_TONE[group.key];
        return (
          <section key={group.key} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => toggleBucket(group.key)}
              aria-expanded={open}
              className="flex w-full items-center gap-2 p-0.5 text-left"
            >
              <span
                className={`grid w-3 flex-none place-items-center text-[9px] text-muted transition-transform duration-[120ms] ${open ? "rotate-90" : ""}`}
                aria-hidden
              >
                ▶
              </span>
              <span className={`size-1.5 flex-none rounded-pill ${tone.dot}`} aria-hidden />
              <span className={`text-micro font-semibold uppercase tracking-[0.04em] ${tone.text}`}>
                {PR_BUCKET_LABEL[group.key]}
              </span>
              <span className="text-[11.5px] tabular-nums text-muted">{group.rows.length}</span>
              <span className="h-px flex-1 bg-hairline" aria-hidden />
            </button>

            {open && (
              <ul className="flex list-none flex-col gap-4 p-0">
                {group.rows.map((row) => {
                  const id = `${row.pr.repo}#${row.pr.number}`;
                  return (
                    <PrCard
                      key={id}
                      bucket={group.key}
                      pr={row.pr}
                      project={row.project}
                      expanded={expanded.includes(id)}
                      onToggleChecks={() => toggleChecks(id)}
                    />
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PrCard({
  bucket,
  pr,
  project,
  expanded,
  onToggleChecks,
}: {
  bucket: PrBucket;
  pr: PrLite;
  project?: ProjectRef;
  expanded: boolean;
  onToggleChecks: () => void;
}) {
  const failing = (pr.checks ?? []).filter((check) => isFailing(check));
  return (
    <li className="relative flex flex-col gap-2.5 rounded-[10px] border border-hairline bg-surface px-[17px] py-4 transition-colors duration-[120ms] hover:border-grid hover:bg-surface-2">
      {/* The whole card is the link, as everywhere else on the board; the
          project chip and the check strip sit above the overlay it casts. */}
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer"
        title="Open on GitHub"
        className="flex items-start gap-[11px] text-inherit after:absolute after:inset-0 after:content-['']"
      >
        <PrRing bucket={bucket} />
        <span className="min-w-0 flex-1 text-[14.5px] font-medium tracking-[-0.004em] text-pretty text-ink">
          <span className="font-mono text-meta font-normal tabular-nums text-muted">#{pr.number}</span> {pr.title}
        </span>
      </a>

      <div className="flex flex-wrap items-center gap-x-2.5 pl-6">
        <span className="inline-flex items-center gap-[5px] font-mono text-[11.5px] tabular-nums text-muted">
          <GitHubMark />
          {pr.repo}
        </span>
        {pr.headRef && (
          <>
            <Separator />
            <span className="max-w-[260px] truncate font-mono text-[11.5px] text-muted">{pr.headRef}</span>
          </>
        )}
        {pr.additions !== undefined && pr.deletions !== undefined && (
          <span className="inline-flex items-center gap-[5px] text-meta tabular-nums">
            <span className="text-good">+{pr.additions.toLocaleString()}</span>
            <span className="text-critical">−{pr.deletions.toLocaleString()}</span>
          </span>
        )}
        <Separator />
        {project ? (
          <Link
            href={`/projects/${project.slug}`}
            className="relative z-10 inline-flex items-center gap-1.5 text-meta text-ink-2 transition-colors duration-[120ms] hover:text-ink"
          >
            <ProjectTile project={project} />
            {project.name}
          </Link>
        ) : (
          <span title="Not tracked by a project" className="text-meta text-grid">
            —
          </span>
        )}
        <ReviewCluster bucket={bucket} pr={pr} />
      </div>

      {failing.length > 0 && (
        <CheckStrip
          checks={pr.checks ?? []}
          failing={failing}
          expanded={expanded}
          onToggle={onToggleChecks}
        />
      )}
    </li>
  );
}

function Separator() {
  return (
    <span className="text-grid" aria-hidden>
      ·
    </span>
  );
}

function ProjectTile({ project }: { project: ProjectRef }) {
  const accent = tileAccent({ slug: project.slug, accent: project.accent ?? null });
  return (
    <span
      className={`grid size-[14px] flex-none place-items-center rounded-[4px] text-[8.5px] font-semibold ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
      aria-hidden
    >
      {tileGlyph({ name: project.name, icon: project.icon ?? null })}
    </span>
  );
}

/**
 * The review decision, then who is on it. A decision that only repeats the
 * bucket is left out — a draft row saying "draft" spends a column on a word the
 * ring beside it already carries.
 */
function ReviewCluster({ bucket, pr }: { bucket: PrBucket; pr: PrLite }) {
  const reviewers = pr.reviewers ?? [];
  const decision = reviewDecisionLabel(bucket, pr, reviewers);
  if (!decision && reviewers.length === 0) return null;
  return (
    <span className="ml-auto inline-flex items-center gap-[7px]">
      {decision && <span className={`text-meta ${decision.tone}`}>{decision.text}</span>}
      {reviewers.map((reviewer) => (
        <Avatar key={reviewer} author={reviewer} size="xs" />
      ))}
    </span>
  );
}

function reviewDecisionLabel(
  bucket: PrBucket,
  pr: PrLite,
  reviewers: string[],
): { text: string; tone: string } | null {
  if (bucket === "draft") return null;
  if (pr.reviewDecision === "approved") return { text: "approved", tone: "text-good" };
  if (pr.reviewDecision === "changes_requested") {
    return { text: pr.changesRequestedBy ? `changes by ${pr.changesRequestedBy}` : "changes requested", tone: "text-serious" };
  }
  if (reviewers.length === 0) return null;
  const text = reviewers.length === 1 ? "1 review pending" : `${reviewers.length} reviewers`;
  return { text, tone: "text-muted" };
}

const FAILING_CONCLUSIONS = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure"]);

function isFailing(check: { status: string; conclusion: string | null }): boolean {
  return check.status === "completed" && check.conclusion !== null && FAILING_CONCLUSIONS.has(check.conclusion);
}

/**
 * Which check broke, without a trip to GitHub. The header is a button and sits
 * outside the card's link, so opening the list never navigates away from it.
 */
function CheckStrip({
  checks,
  failing,
  expanded,
  onToggle,
}: {
  checks: { name?: string; status: string; conclusion: string | null; started_at?: string | null; completed_at?: string | null }[];
  failing: { name?: string }[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative z-10 ml-6 flex flex-col overflow-hidden rounded-control border border-critical/35 bg-critical/[0.08]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex items-center gap-2 px-[9px] py-1.5 text-left text-meta text-ink-2"
      >
        <span className="size-[5px] flex-none rounded-pill bg-critical" aria-hidden />
        <span className="flex-none font-medium text-critical">
          {failing.length} of {checks.length} checks failed
        </span>
        <span className="min-w-0 truncate text-muted">
          {failing.map((check) => check.name ?? "check").join(" · ")}
        </span>
        <span className="ml-auto flex-none text-micro text-muted">{expanded ? "Hide" : "Show all"}</span>
      </button>
      {expanded && (
        <ul className="flex list-none flex-col border-t border-critical/35 px-0 pt-0.5 pb-1">
          {checks.map((check, index) => (
            <li
              key={`${check.name ?? "check"}-${index}`}
              className="flex items-center gap-2 py-1 pr-[9px] pl-[22px] text-meta"
            >
              <span className={`size-[5px] flex-none rounded-pill ${checkGlyph(check)}`} aria-hidden />
              <span className={`min-w-0 flex-1 truncate ${isFailing(check) ? "text-ink" : "text-muted"}`}>
                {check.name ?? "check"}
              </span>
              <span className="flex-none tabular-nums text-muted">{checkDuration(check)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function checkGlyph(check: { status: string; conclusion: string | null }): string {
  if (isFailing(check)) return "bg-critical";
  if (check.status === "completed") return "bg-good";
  return "border border-grid";
}
