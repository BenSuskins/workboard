/**
 * One-time Google OAuth (loopback flow) for Drive read-only metadata.
 * Prereqs: a Google Cloud OAuth client (type "Web application") with
 * http://localhost:8123/callback in its authorized redirect URIs, and
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in the environment.
 * Stores the refresh token next to the database (data/google-token.json).
 */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { googleTokenPath } from "@workboard/core";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first (see .env.example).");
  process.exit(1);
}

const PORT = 8123;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

console.log("\nOpen this URL in your browser and approve access:\n");
console.log(authUrl);
console.log(`\nWaiting for the redirect on ${REDIRECT} …`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Missing ?code");
    return;
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenRes.json()) as { refresh_token?: string; error?: string };
  if (!tokens.refresh_token) {
    res.writeHead(500).end(`Token exchange failed: ${JSON.stringify(tokens)}`);
    console.error("Token exchange failed:", tokens);
    process.exit(1);
  }
  const path = googleTokenPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2));
  res.writeHead(200, { "Content-Type": "text/plain" }).end("Workboard: Google Drive connected. You can close this tab.");
  console.log(`\nRefresh token saved to ${path}. Google Docs links will now show live metadata.`);
  server.close();
  process.exit(0);
});
server.listen(PORT);
