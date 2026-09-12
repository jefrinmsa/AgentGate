import express from "express";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import "dotenv/config";
import paymentsRouter from "../src/routes/payments.js";
import { createAgentWallet } from "../src/payments/circleWallets.js";
import { setTrustRecord, getPayments, writePayments } from "../src/db/store.js";

async function runPaymentTest() {
  console.log("==========================================================");
  console.log("          AgentGate Payments Flow Verification            ");
  console.log("==========================================================\n");

  // Step 1: Create two agent wallets via circleWallets
  console.log("▶ Step 1: Creating agent wallets via circleWallets...");
  const senderAgentId = "agent-sender-01";
  const trustedVendorAgentId = "agent-vendor-trusted";

  let senderWallet = await createAgentWallet(senderAgentId);
  let trustedVendorWallet = await createAgentWallet(trustedVendorAgentId);

  // Fallback if running without external Circle testnet credentials
  if (!senderWallet) {
    senderWallet = "0x1111111111111111111111111111111111111111";
  }
  if (!trustedVendorWallet) {
    trustedVendorWallet = "0x2222222222222222222222222222222222222222";
  }

  console.log(`  - Sending Agent:   ${senderAgentId} -> Address: ${senderWallet}`);
  console.log(`  - Trusted Vendor:  ${trustedVendorAgentId} -> Address: ${trustedVendorWallet}\n`);

  // Step 2: Fund sending wallet from Arc testnet faucet (or log instructions)
  console.log("▶ Step 2: Funding sending wallet from Arc testnet faucet...");
  let faucetRequested = false;

  if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
    try {
      const client = initiateDeveloperControlledWalletsClient({
        apiKey: process.env.CIRCLE_API_KEY,
        entitySecret: process.env.CIRCLE_ENTITY_SECRET,
      });

      console.log(`  Attempting automated faucet request for ${senderWallet}...`);
      await client.requestTestnetTokens({
        address: senderWallet,
        blockchain: (process.env.ARC_BLOCKCHAIN || "ARC-TESTNET") as any,
        usdc: true,
      });
      console.log("  ✅ Faucet request sent successfully via Circle SDK!");
      faucetRequested = true;
    } catch (faucetErr: any) {
      console.log(`  ⚠️ Automated faucet request note: ${faucetErr?.message || faucetErr}`);
    }
  }

  if (!faucetRequested) {
    console.log("  ℹ️ Manual Faucet Instructions for Arc Testnet:");
    console.log(`     1. Open the Circle Faucet at: https://faucet.circle.com`);
    console.log(`     2. Choose network: Arc Testnet`);
    console.log(`     3. Target Address: ${senderWallet}`);
    console.log(`     4. Click "Request Tokens" (sends 10 testnet USDC)\n`);
  } else {
    console.log("");
  }

  // Step 3: Establish initial trust record for the trusted vendor
  // Give this vendor an established history so the trust ceiling auto-approves small payments:
  // 4 completed payments with $2.50 avg -> Ceiling = 5 * sqrt(4) = $10.00 USDC
  console.log("▶ Step 3: Configuring trust history for trusted vendor...");
  await setTrustRecord(trustedVendorWallet, {
    paymentCount: 4,
    totalPaid: 10.0,
    averageAmount: 2.5,
    lastOutcome: "paid",
  });
  console.log(`  - Counterparty: ${trustedVendorWallet}`);
  console.log("  - Established paymentCount: 4, averageAmount: $2.50, trust ceiling: $10.00 USDC\n");

  // Step 4: Ensure the HTTP payment server is available
  console.log("▶ Step 4: Ensuring server endpoint is running...");
  let serverInstance: any = null;
  let baseUrl = process.env.SERVER_URL || "http://localhost:4000";

  try {
    const ping = await fetch(`${baseUrl}/pay`, { method: "POST" });
    if (ping.status !== 404) {
      console.log(`  Connected to running server at ${baseUrl}`);
    }
  } catch {
    console.log(`  No external server detected, starting local server on port 4000...`);
    const app = express();
    app.use(express.json());
    app.use("/pay", paymentsRouter);
    serverInstance = app.listen(4000);
    baseUrl = "http://localhost:4000";
    console.log(`  Local server listening on ${baseUrl}`);
  }
  console.log("");

  // Step 5: Fire the 3 payment requests
  console.log("▶ Step 5: Firing 3 payment requests to POST /pay...\n");
  const testResults: any[] = [];

  // Request 1: Small payment #1 to trusted vendor ($2.00) -> should auto-pay
  console.log("--- Payment 1: Small payment to trusted vendor ($2.00 USDC) ---");
  const req1Payload = {
    fromAgentId: senderWallet,
    counterpartyId: trustedVendorWallet,
    amountUsdc: 2.0,
    description: "Cloud compute micro-invoice #101",
  };
  const res1 = await fetch(`${baseUrl}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req1Payload),
  });
  const data1: any = await res1.json();
  console.log("Response 1:", JSON.stringify(data1, null, 2));
  testResults.push({
    test: "1. Small payment #1 (Trusted vendor)",
    amount: "$2.00 USDC",
    expected: "paid",
    actual: data1.status,
    identifier: data1.txHash ? `txHash: ${data1.txHash}` : data1.paymentId || "N/A",
    pass: data1.status === "paid",
  });
  console.log("");

  // Request 2: Small payment #2 to trusted vendor ($3.50) -> should auto-pay
  console.log("--- Payment 2: Second small payment to trusted vendor ($3.50 USDC) ---");
  const req2Payload = {
    fromAgentId: senderWallet,
    counterpartyId: trustedVendorWallet,
    amountUsdc: 3.5,
    description: "Vector search API indexing fee #102",
  };
  const res2 = await fetch(`${baseUrl}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req2Payload),
  });
  const data2: any = await res2.json();
  console.log("Response 2:", JSON.stringify(data2, null, 2));
  testResults.push({
    test: "2. Small payment #2 (Trusted vendor)",
    amount: "$3.50 USDC",
    expected: "paid",
    actual: data2.status,
    identifier: data2.txHash ? `txHash: ${data2.txHash}` : data2.paymentId || "N/A",
    pass: data2.status === "paid",
  });
  console.log("");

  // Request 3: Large payment to brand-new counterparty ($350.00) -> should freeze
  const brandNewCounterparty = "0x9999999999999999999999999999999999999999";
  console.log(`--- Payment 3: Large payment to brand-new counterparty ($350.00 USDC) ---`);
  const req3Payload = {
    fromAgentId: senderWallet,
    counterpartyId: brandNewCounterparty,
    amountUsdc: 350.0,
    description: "DataVault99 premium market research access",
  };
  const res3 = await fetch(`${baseUrl}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req3Payload),
  });
  const data3: any = await res3.json();
  console.log("Response 3:", JSON.stringify(data3, null, 2));
  testResults.push({
    test: "3. Large payment (Brand-new counterparty)",
    amount: "$350.00 USDC",
    expected: "pending_approval",
    actual: data3.status,
    identifier: data3.paymentId ? `paymentId: ${data3.paymentId}` : data3.txHash || "N/A",
    pass: data3.status === "pending_approval",
  });
  console.log("\n");

  // Step 6: Print formatted test results
  console.log("==========================================================");
  console.log("                     Test Results                         ");
  console.log("==========================================================");
  console.table(
    testResults.map((r) => ({
      Scenario: r.test,
      Amount: r.amount,
      Expected: r.expected,
      Actual: r.actual,
      Result: r.pass ? "✅ PASS" : "❌ FAIL",
      Identifier: r.identifier,
    }))
  );

  const allPassed = testResults.every((r) => r.pass);
  console.log(
    allPassed
      ? "🎉 All payment test scenarios completed successfully!"
      : "⚠️ Some test scenarios did not match expected outcomes."
  );

  if (serverInstance) {
    serverInstance.close();
  }
}

runPaymentTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
