import Link from "next/link";
import { CATEGORY_PRESETS, listProjects } from "@workboard/core";
import { ProjectForm } from "@/components/project-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  // Offer the categories already in use before falling back to the presets.
  const existing = listProjects(db(), {}).map((project) => project.category);
  const categories = [...new Set([...existing, ...CATEGORY_PRESETS])].sort();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-7">
      <div className="flex items-center gap-2 text-meta text-muted">
        <Link href="/" className="hover:text-ink">
          Board
        </Link>
        <span>/</span>
        <span className="text-ink-2">New project</span>
      </div>

      <ProjectForm categories={categories} />
    </div>
  );
}
