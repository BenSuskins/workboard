import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { listOpenQuestions, listProjects, getProjectDetail, type ProjectDetail } from "@workboard/core";
import { CommandPalette } from "@/components/command-palette";
import { Sidebar, type SidebarProject } from "@/components/sidebar";
import { db } from "@/lib/db";
import { loadPullRequests } from "@/lib/prs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Workboard",
  description: "AI-native dashboard for all your work projects",
};

// Runs before paint: honor saved theme and sidebar width. Kept inline to avoid FOUC.
const shellInit = `try{var t=localStorage.getItem("wb-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.dataset.sidebar=localStorage.getItem("wb-sidebar")==="collapsed"?"collapsed":"expanded"}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.dataset.sidebar="expanded"}`;

export default async function RootLayout({ children, panel }: { children: React.ReactNode; panel: React.ReactNode }) {
  const database = db();
  const projects = listProjects(database, {});
  const details = projects
    .map((project) => getProjectDetail(database, project.id, { postsLimit: 0 }))
    .filter((detail): detail is ProjectDetail => detail !== undefined);

  const sidebarProjects: SidebarProject[] = details.map(({ project, tasks, posts }) => ({
    id: project.id,
    slug: project.slug,
    name: project.name,
    icon: project.icon,
    accent: project.accent,
    openTasks: tasks.filter((task) => task.status !== "done").length,
    upForGrabs: tasks.filter((task) => task.agentReady && task.status === "todo" && !task.claimedAt).length,
    questions: posts.filter((post) => post.type === "question" && !post.answeredAt).length,
  }));

  // The badge counts work outstanding, so a board of finished issues reads as empty.
  const openIssueCount = details.reduce(
    (total, detail) => total + detail.tasks.filter((task) => task.status !== "done").length,
    0,
  );
  const openWarnings = details.reduce((total, detail) => total + detail.openWarnings.length, 0);
  const inboxCount = listOpenQuestions(database).length + openWarnings;
  // Same source as /prs — a badge that disagreed with the page it links to would be worse than none.
  const prCount = (await loadPullRequests(details)).rows.length;

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: shellInit }} />
      </head>
      <body className="min-h-screen">
        <Sidebar
          projects={sidebarProjects}
          inboxCount={inboxCount}
          openIssueCount={openIssueCount}
          prCount={prCount}
        />
        <CommandPalette />
        {/* The rail is fixed, so the content pane owns the matching offset. */}
        <div className="wb-content min-h-screen">
          <main className="mx-auto max-w-6xl px-6 py-7">{children}</main>
        </div>
        {panel}
      </body>
    </html>
  );
}
