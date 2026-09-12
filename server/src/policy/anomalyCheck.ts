import { getTrustRecord } from "../db/store.js";
import { getTrustCeiling } from "./trustScore.js";

// Decides whether a payment request should freeze.
//
// isAnomalous({ counterpartyId, amount, description }) -> boolean + reason
//
// Checks implemented:
// - counterparty has no trust record (new counterparty) -> always flag
// - amount exceeds current trust ceiling from trustScore.ts -> flag
// - amount is more than 5x the counterparty's historical average amount (if they have one) -> flag

export interface AnomalyCheckParams {
  counterpartyId: string;
  amount: number | string;
  description?: string;
}

export interface AnomalyCheckResult {
  flagged: boolean;
  reason: string;
}

/**
 * Checks if a payment request is anomalous.
 *
 * Flags if:
 * 1. Counterparty has no trust record (or 0 completed payments).
 * 2. Amount exceeds current trust ceiling from trustScore.ts.
 * 3. Amount is more than 5x counterparty's historical average amount.
 *
 * @param params - { counterpartyId, amount, description }
 * @returns { flagged: boolean, reason: string }
 */
export async function isAnomalous({
  counterpartyId,
  amount,
  description,
}: AnomalyCheckParams): Promise<AnomalyCheckResult> {
  const numericAmount =
    typeof amount === "string" ? parseFloat(amount) || 0 : amount;

  // 1. Check if counterparty has no trust record or 0 payments
  const record = await getTrustRecord(counterpartyId);
  if (!record || !record.paymentCount || record.paymentCount <= 0) {
    return {
      flagged: true,
      reason: `Counterparty "${counterpartyId}" has no trust record.`,
    };
  }

  // 2. Check if amount exceeds current trust ceiling
  const ceiling = await getTrustCeiling(counterpartyId);
  if (numericAmount > ceiling) {
    return {
      flagged: true,
      reason: `Amount ($${numericAmount}) exceeds current trust ceiling of $${ceiling}.`,
    };
  }

  // 3. Check if amount is > 5x historical average
  if (record.averageAmount > 0 && numericAmount > 5 * record.averageAmount) {
    return {
      flagged: true,
      reason: `Amount ($${numericAmount}) is more than 5x the historical average ($${record.averageAmount}).`,
    };
  }

  return {
    flagged: false,
    reason: "",
  };
}
