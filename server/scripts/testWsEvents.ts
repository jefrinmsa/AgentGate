import http from "node:http";
import express from "express";
import { WebSocket } from "ws";
import paymentsRouter from "../src/routes/payments.js";
import { initWebSocketServer, broadcastResolved, closeWebSocketServer } from "../src/ws.js";
import { setTrustRecord } from "../src/db/store.js";

async function testWebSocketFlow() {
  console.log("==========================================================");
  console.log("       AgentGate WebSocket & Risk Brief Test Suite        ");
  console.log("==========================================================\n");

  const app = express();
  app.use(express.json());
  app.use("/pay", paymentsRouter);

  const server = http.createServer(app);
  initWebSocketServer(server);

  const port = 4999;
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`▶ Step 1: Test server & WebSocket listening on http://localhost:${port}`);
      resolve();
    });
  });

  // Step 2: Connect a WebSocket client
  console.log("▶ Step 2: Connecting WebSocket client to ws://localhost:4999...");
  const ws = new WebSocket(`ws://localhost:${port}`);
  const receivedEvents: any[] = [];

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WS connection timed out")), 5000);
    ws.on("open", () => {
      clearTimeout(timeout);
      console.log("  ✅ WebSocket client connected successfully!\n");
      resolve();
    });
    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        console.log(`  📩 [WS Client Received] type="${parsed.type}":`, JSON.stringify(parsed, null, 2));
        receivedEvents.push(parsed);
      } catch (err) {
        console.error("  ❌ Failed to parse WS message:", err);
      }
    });
    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Step 3: Trigger a flagged payment (new counterparty with $350 amount)
  console.log("▶ Step 3: Triggering a FLAGGED payment to POST /pay...");
  const flaggedCounterparty = "0x9999999999999999999999999999999999999999";
  const flaggedRes = await fetch(`http://localhost:${port}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromAgentId: "agent-sender-test",
      counterpartyId: flaggedCounterparty,
      amountUsdc: 350.0,
      description: "DataVault99 premium market research access",
    }),
  });

  const flaggedJson: any = await flaggedRes.json();
  console.log("  HTTP Response:", JSON.stringify(flaggedJson, null, 2));

  // Small delay to allow WS message delivery
  await new Promise((r) => setTimeout(r, 200));

  // Step 4: Setup trusted vendor and trigger an APPROVED payment
  console.log("\n▶ Step 4: Setting up trust history and triggering an APPROVED payment...");
  const trustedVendor = "0x2222222222222222222222222222222222222222";
  await setTrustRecord(trustedVendor, {
    paymentCount: 5,
    totalPaid: 25.0,
    averageAmount: 5.0,
    lastOutcome: "paid",
  });

  const paidRes = await fetch(`http://localhost:${port}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromAgentId: "agent-sender-test",
      counterpartyId: trustedVendor,
      amountUsdc: 4.5,
      description: "Cloud GPU slice compute invoice #401",
    }),
  });

  const paidJson: any = await paidRes.json();
  console.log("  HTTP Response:", JSON.stringify(paidJson, null, 2));

  await new Promise((r) => setTimeout(r, 200));

  // Step 5: Test broadcastResolved
  console.log("\n▶ Step 5: Testing broadcastResolved event...");
  broadcastResolved({
    paymentId: flaggedJson.paymentId || "pay_manual_test",
    counterparty: flaggedCounterparty,
    counterpartyId: flaggedCounterparty,
    amount: 350.0,
    amountUsdc: 350.0,
    approved: true,
    txHash: "0xsimulatedtxhashforapproval123456",
    timestamp: Date.now(),
  });

  await new Promise((r) => setTimeout(r, 200));

  // Step 6: Validate received events
  console.log("\n==========================================================");
  console.log("                   Event Verification                     ");
  console.log("==========================================================");

  const frozenEvent = receivedEvents.find((e) => e.type === "frozen");
  const paidEvent = receivedEvents.find((e) => e.type === "paid");
  const resolvedEvent = receivedEvents.find((e) => e.type === "resolved");

  const results = [
    {
      check: "Frozen event received via WebSocket",
      pass: !!frozenEvent,
      detail: frozenEvent ? `Brief: "${frozenEvent.riskBrief}"` : "Missing",
    },
    {
      check: "Risk brief included in frozen event",
      pass: !!frozenEvent?.riskBrief && typeof frozenEvent.riskBrief === "string",
      detail: frozenEvent?.riskBrief || "None",
    },
    {
      check: "Paid event received via WebSocket",
      pass: !!paidEvent,
      detail: paidEvent ? `txHash: ${paidEvent.txHash}` : "Missing",
    },
    {
      check: "Resolved event received via WebSocket",
      pass: !!resolvedEvent,
      detail: resolvedEvent ? `approved: ${resolvedEvent.approved}` : "Missing",
    },
  ];

  console.table(
    results.map((r) => ({
      Check: r.check,
      Result: r.pass ? "✅ PASS" : "❌ FAIL",
      Detail: r.detail,
    }))
  );

  // Teardown
  ws.close();
  await closeWebSocketServer();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  const allPassed = results.every((r) => r.pass);
  if (!allPassed) {
    throw new Error("One or more WebSocket event assertions failed");
  }
  console.log("\n🎉 All WebSocket & Risk Brief integration tests passed!");
}

testWebSocketFlow().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
