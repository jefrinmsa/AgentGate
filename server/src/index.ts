// Entry point: starts the HTTP API (for agent payment requests) and the
// WebSocket server (for pushing live events to the dashboard feed).

import http from "node:http";
import express from "express";
import "dotenv/config";
import paymentsRouter from "./routes/payments.js";
import { initWebSocketServer } from "./ws.js";

const app = express();
app.use(express.json());

// Enable CORS for dashboard web client
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use("/pay", paymentsRouter);

const port = process.env.PORT || 4000;
const server = http.createServer(app);

// Attach WebSocket server to the same HTTP server as Express
initWebSocketServer(server);

server.listen(port, () => console.log(`agentgate server on :${port}`));

export { app, server };
export default app;
