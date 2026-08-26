import Link from "next/link";
import type { Project } from "@workboard/core";
import { Avatar } from "./avatar";
import { StatusBadge } from "./badges";
import { HEALTH_LABEL } from "./labels";
import { TimeAgo } from "./time-ago";
import { fullDate } from "@/lib/format";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-meta text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-meta text-ink-2">{children}</dd>
    </div>
  );
}

/**
 * The metadata sidebar on a detail view. Every field here is something the
 * store actually holds — there is no view counter, no visibility setting and no
 * reader list, because Workboard does not record any of those.
 */
export function ContextCard({
  project,
  author,
  createdAt,
  extra,
}: {
  project: Project;
  author: string;
  createdAt: number;
  extra?: { label: string; value: React.ReactNode }[];
}) {
  return (
    <aside className="rounded-card border border-hairline bg-surface p-4">
      <h2 className="mb-2 text-meta font-semibold text-ink">Context</h2>
      <dl className="divide-y divide-hairline">
        <Row label="Project">
          <Link href={`/projects/${project.slug}`} className="text-accent hover:underline">
            {project.name}
          </Link>
        </Row>
        <Row label="State">
          <StatusBadge status={project.status} />
        </Row>
        <Row label="Health">{HEALTH_LABEL[project.health]}</Row>
        <Row label="Priority">
          <span className="capitalize">{project.priority}</span>
        </Row>
        <Row label="Category">
          <span className="capitalize">{project.category}</span>
        </Row>
        {extra?.map((item) => (
          <Row key={item.label} label={item.label}>
            {item.value}
          </Row>
        ))}
        <Row label="Written">
          <span title={fullDate(createdAt)}>
            <TimeAgo at={createdAt} />
          </span>
        </Row>
        <Row label="Author">
          <span className="inline-flex items-center gap-1.5">
            <Avatar author={author} size="sm" />
            {author}
          </span>
        </Row>
        <Row label="Last activity">
          <TimeAgo at={project.lastActivityAt} />
        </Row>
      </dl>
    </aside>
  );
}
