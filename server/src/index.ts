// Entry point: starts the HTTP API (for agent payment requests) and the
// WebSocket server (for pushing live events to the dashboard feed).

import express from "express";
import "dotenv/config";
import paymentsRouter from "./routes/payments.js";

const app = express();
app.use(express.json());

app.use("/pay", paymentsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`agentgate server on :${port}`));

export default app;
