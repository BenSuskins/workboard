import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { listOpenQuestions, listProjects, getProjectDetail, type ProjectDetail } from "@workboard/core";
import { CommandPalette } from "@/components/command-palette";
import { Sidebar, type SidebarProject } from "@/components/sidebar";
import { db } from "@/lib/db";
import { loadPullRequests } from "@/lib/prs";
import "./globals.css";

// Inter is self-hosted (see the @font-face in globals.css), not loaded through
// next/font: Google's build strips the character variants and stylistic sets
// the UI depends on, and ships no optical-size axis.
// No `weight` on Geist: that selects its variable axis.
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Workboard",
  description: "AI-native dashboard for all your work projects",
};

// Runs before paint: honor saved theme, sidebar state, and the two dragged
// pane widths. Kept inline to avoid FOUC and a first-frame layout shift.
const shellInit = `try{var t=localStorage.getItem("wb-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.dataset.sidebar=localStorage.getItem("wb-sidebar")==="collapsed"?"collapsed":"expanded";[["wb-sidebar-width","--wb-sidebar-w"],["wb-panel-width","--wb-panel-w"]].forEach(function(p){var w=parseInt(localStorage.getItem(p[0]),10);if(w>0)r.style.setProperty(p[1],w+"px")})}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.dataset.sidebar="expanded"}`;

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

  const openWarnings = details.reduce((total, detail) => total + detail.openWarnings.length, 0);
  const inboxCount = listOpenQuestions(database).length + openWarnings;
  // Same source as /prs — a badge that disagreed with the page it links to would be worse than none.
  const prCount = (await loadPullRequests(details)).rows.length;

  return (
    <html lang="en" suppressHydrationWarning className={geistMono.variable}>
      <head>
        {/* Self-hosted, so nothing else will discover it before first paint. The
            italic face is deliberately not preloaded — only rendered markdown uses it. */}
        <link rel="preload" href="/fonts/InterVariable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: shellInit }} />
      </head>
      <body className="min-h-screen">
        <Sidebar projects={sidebarProjects} inboxCount={inboxCount} prCount={prCount} />
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
