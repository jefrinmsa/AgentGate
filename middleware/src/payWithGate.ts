// The drop-in function any agent framework wraps its payment calls in,
// instead of paying a counterparty directly:
//
//   import { payWithGate } from "@agentgate/middleware";
//   const result = await payWithGate({
//     agentId: "research-agent-1",
//     counterpartyId: "scisearch-api",
//     amountUsdc: 0.02,
//     description: "1 search query",
//   });
//   // result.status === "paid" | "pending_approval"
//
// Internally this just POSTs to the AgentGate server's /pay endpoint and
// returns the result — all the trust/anomaly/Ledger logic is server-side.
// Keeping this thin is what makes it "a few lines to add to any agent",
// which is the pitch for the Arc Continuity Track.
//
// TODO: implement the fetch call against server/src/routes/payments.ts
