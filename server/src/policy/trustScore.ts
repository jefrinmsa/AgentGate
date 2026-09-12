import {
  getTrustRecord,
  setTrustRecord,
  PaymentStatus,
  TrustRecord,
} from "../db/store.js";

// Tracks a rolling trust score per counterparty:
// - number of completed payments
// - average invoice size seen from this counterparty
// - any disputes/failures
//
// getTrustCeiling(counterpartyId) -> current auto-approve $ limit
// recordOutcome(counterpartyId, amount, outcome) -> updates the score
//
// Ceiling formula: baseCeiling ($5) * sqrt(paymentCount), capped at maxCeiling ($500).
// A counterparty with zero payment history returns ceiling 0 (always flags).

export const BASE_CEILING = 5;
export const MAX_CEILING = 500;

/**
 * Calculates the current auto-approve limit in USDC for a given counterparty.
 *
 * Formula: baseCeiling ($5) * sqrt(paymentCount), capped at maxCeiling ($500).
 * If the counterparty has zero payment history or record does not exist, returns 0.
 *
 * @param counterpartyId - Counterparty identifier
 * @returns Trust ceiling amount in USDC
 */
export async function getTrustCeiling(
  counterpartyId: string
): Promise<number> {
  const record = await getTrustRecord(counterpartyId);

  if (!record || !record.paymentCount || record.paymentCount <= 0) {
    return 0;
  }

  const rawCeiling = BASE_CEILING * Math.sqrt(record.paymentCount);
  const ceiling = Math.min(rawCeiling, MAX_CEILING);

  return Number(ceiling.toFixed(2));
}

/**
 * Updates rolling trust score for a counterparty following a payment outcome.
 *
 * If outcome is "paid", increments paymentCount and updates totalPaid and averageAmount.
 * For all outcomes, updates lastOutcome.
 *
 * @param counterpartyId - Counterparty identifier
 * @param amount - Payment amount in USDC
 * @param outcome - "paid" | "frozen" | "rejected" (or custom status)
 * @returns The updated TrustRecord
 */
export async function recordOutcome(
  counterpartyId: string,
  amount: number | string,
  outcome: PaymentStatus | string
): Promise<TrustRecord> {
  const existing = await getTrustRecord(counterpartyId);
  const numericAmount =
    typeof amount === "string" ? parseFloat(amount) || 0 : amount;

  let paymentCount = existing?.paymentCount || 0;
  let totalPaid = existing?.totalPaid || 0;
  let averageAmount = existing?.averageAmount || 0;

  if (outcome === "paid") {
    paymentCount += 1;
    totalPaid += numericAmount;
    averageAmount =
      paymentCount > 0 ? Number((totalPaid / paymentCount).toFixed(2)) : 0;
  }

  const updatedRecord: TrustRecord = {
    paymentCount,
    totalPaid: Number(totalPaid.toFixed(2)),
    averageAmount,
    lastOutcome: outcome,
  };

  await setTrustRecord(counterpartyId, updatedRecord);
  return updatedRecord;
}
