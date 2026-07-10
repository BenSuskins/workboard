export interface JiraIssueSnapshot {
  type: "jira_issue";
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  updatedAt: string;
  url: string;
}

export interface JiraProjectSnapshot {
  type: "jira_project";
  key: string;
  total: number;
  byStatusCategory: Record<string, number>;
  recentIssues: { key: string; summary: string; status: string; updatedAt: string; url: string }[];
  url: string;
}

export function jiraConfigured(): boolean {
  return Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
}

function baseUrl(): string {
  return process.env.JIRA_BASE_URL!.replace(/\/$/, "");
}

async function jira<T>(path: string): Promise<T> {
  const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Jira ${path} → ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return res.json() as Promise<T>;
}

interface RawIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { name: string } };
    assignee: { displayName: string } | null;
    updated: string;
  };
}

export async function fetchJiraIssue(key: string): Promise<JiraIssueSnapshot> {
  const issue = await jira<RawIssue>(`/rest/api/3/issue/${key}?fields=summary,status,assignee,updated`);
  return {
    type: "jira_issue",
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    statusCategory: issue.fields.status.statusCategory.name,
    assignee: issue.fields.assignee?.displayName ?? null,
    updatedAt: issue.fields.updated,
    url: `${baseUrl()}/browse/${issue.key}`,
  };
}

export async function fetchJiraProject(key: string): Promise<JiraProjectSnapshot> {
  const jql = encodeURIComponent(`project = ${key} ORDER BY updated DESC`);
  const result = await jira<{ total?: number; issues: RawIssue[] }>(
    `/rest/api/3/search/jql?jql=${jql}&fields=summary,status,updated&maxResults=100`,
  );
  const byStatusCategory: Record<string, number> = {};
  for (const issue of result.issues) {
    const cat = issue.fields.status.statusCategory.name;
    byStatusCategory[cat] = (byStatusCategory[cat] ?? 0) + 1;
  }
  return {
    type: "jira_project",
    key,
    total: result.total ?? result.issues.length,
    byStatusCategory,
    recentIssues: result.issues.slice(0, 10).map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name,
      updatedAt: i.fields.updated,
      url: `${baseUrl()}/browse/${i.key}`,
    })),
    url: `${baseUrl()}/browse/${key}`,
  };
}
