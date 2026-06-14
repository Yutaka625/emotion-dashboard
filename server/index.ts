import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { handleAiInsight } from "./aiInsight";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // AIインサイト用に JSON ボディを受け取る（集計データのみ。生フレームは送られない）
  app.use(express.json({ limit: "512kb" }));

  // AIインサイト API（本番）。dev では vite.config.ts のミドルウェアが同じ処理を担う。
  app.post("/api/ai-insight", async (req, res) => {
    const result = await handleAiInsight(req.body, process.env.ANTHROPIC_API_KEY);
    res.status(result.status).json(result.body);
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
