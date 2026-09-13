import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { savePayment, getPayments, getTrustRecord, Payment } from "../db/store.js";
import { isAnomalous } from "../policy/anomalyCheck.js";
import { recordOutcome } from "../policy/trustScore.js";
import { generateRiskBrief } from "../policy/riskBrief.js";
import { transferUsdc } from "../payments/arcTransfer.js";
import { broadcastEvent } from "../ws.js";

const router = Router();

// GET /pay -> list all payments, newest first
router.get("/", async (_req: Request, res: Response) => {
  try {
    const payments = await getPayments();
    const sorted = [...payments].sort((a, b) => b.timestamp - a.timestamp);
    return res.status(200).json(sorted);
  } catch (error: any) {
    console.error("[payments] Failed to fetch payments:", error);
    return res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      fromAgentId,
      counterpartyId: rawCounterpartyId,
      toCounterpartyId,
      amountUsdc,
      description = "",
    } = req.body;

    const counterpartyId = rawCounterpartyId || toCounterpartyId;

    if (!fromAgentId || !counterpartyId || amountUsdc === undefined || amountUsdc === null) {
      return res.status(400).json({
        error: "Missing required fields: fromAgentId, counterpartyId, amountUsdc",
      });
    }

    const numericAmount = Number(amountUsdc);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: "amountUsdc must be a positive number",
      });
    }

    const paymentId = `pay_${randomUUID()}`;

    // 1. Run anomaly detection
    const anomalyResult = await isAnomalous({
      counterpartyId,
      amount: numericAmount,
      description,
    });

    // 2. If flagged -> generate risk brief, save as "frozen", broadcast WS event and return pending_approval
    if (anomalyResult.flagged) {
      console.log(
        `[payments] Payment ${paymentId} flagged: ${anomalyResult.reason}. Generating risk brief...`
      );

      const trustHistory = await getTrustRecord(counterpartyId);
      const riskBrief = await generateRiskBrief({
        counterpartyId,
        amount: numericAmount,
        description,
        trustHistory,
      });

      console.log(`[payments] Risk brief generated: "${riskBrief}". Freezing payment.`);

      const payment: Payment = {
        id: paymentId,
        fromAgentId,
        counterpartyId,
        amountUsdc: numericAmount,
        description,
        status: "frozen",
        txHash: null,
        riskBrief,
        timestamp: Date.now(),
      };

      await savePayment(payment);
      await recordOutcome(counterpartyId, numericAmount, "frozen");

      broadcastEvent({
        type: "frozen",
        paymentId,
        counterparty: counterpartyId,
        counterpartyId,
        amount: numericAmount,
        amountUsdc: numericAmount,
        description,
        riskBrief,
        reason: anomalyResult.reason,
        timestamp: payment.timestamp,
      });

      return res.status(200).json({
        status: "pending_approval",
        paymentId,
        riskBrief,
      });
    }

    // 3. If not flagged -> execute transfer on Arc
    console.log(
      `[payments] Payment ${paymentId} approved. Executing transfer on Arc...`
    );

    const transferResult = await transferUsdc({
      fromWalletId: fromAgentId,
      toWalletId: counterpartyId,
      amount: numericAmount,
    });

    const txHash = transferResult.txHash;

    // Record positive outcome and update trust score
    await recordOutcome(counterpartyId, numericAmount, "paid");

    // Save payment as "paid"
    const payment: Payment = {
      id: paymentId,
      fromAgentId,
      counterpartyId,
      amountUsdc: numericAmount,
      description,
      status: "paid",
      txHash,
      timestamp: Date.now(),
    };

    await savePayment(payment);

    // Broadcast "paid" event to WebSocket clients
    broadcastEvent({
      type: "paid",
      paymentId,
      counterparty: counterpartyId,
      counterpartyId,
      amount: numericAmount,
      amountUsdc: numericAmount,
      description,
      txHash,
      timestamp: payment.timestamp,
    });

    return res.status(200).json({
      status: "paid",
      txHash,
    });
  } catch (error: any) {
    console.error("[payments] Error processing payment request:", error);
    return res.status(500).json({
      error: "Internal server error during payment processing",
      message: error?.message || String(error),
    });
  }
});

export default router;
