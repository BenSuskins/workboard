import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createServer } from "./server.js";

const PORT = Number(process.env.WORKBOARD_MCP_PORT ?? 8787);
const TOKEN = process.env.WORKBOARD_MCP_TOKEN;

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, server: "workboard-mcp" });
});

app.all("/mcp", async (req, res) => {
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: set Authorization: Bearer <WORKBOARD_MCP_TOKEN>" },
      id: null,
    });
    return;
  }
  // Stateless mode: a fresh server+transport per request keeps things simple
  // for a local single-user setup and works with every streamable-HTTP client.
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[workboard-mcp] request failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

app.listen(PORT, () => {
  console.log(`workboard MCP server listening on http://localhost:${PORT}/mcp${TOKEN ? " (bearer token required)" : ""}`);
});
