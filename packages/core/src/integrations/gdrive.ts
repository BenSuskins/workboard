import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultDataDir } from "../store/store.js";

export interface GdocSnapshot {
  type: "gdoc";
  fileId: string;
  name: string;
  mimeType: string;
  modifiedAt: string;
  url: string;
}

export function googleTokenPath(): string {
  return process.env.GOOGLE_TOKEN_PATH ?? join(dirname(defaultDataDir()), "google-token.json");
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && existsSync(googleTokenPath()));
}

let cached: { token: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const { refresh_token } = JSON.parse(readFileSync(googleTokenPath(), "utf8")) as { refresh_token: string };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh → ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export async function fetchGdoc(fileId: string): Promise<GdocSnapshot> {
  const token = await accessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,webViewLink&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive files.get ${fileId} → ${res.status}`);
  const file = (await res.json()) as { id: string; name: string; mimeType: string; modifiedTime: string; webViewLink: string };
  return {
    type: "gdoc",
    fileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedAt: file.modifiedTime,
    url: file.webViewLink,
  };
}
