import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

export type PaymentStatus = "paid" | "frozen" | "rejected";

export interface Payment {
  id: string;
  fromAgentId: string;
  counterpartyId: string;
  amountUsdc: number;
  description: string;
  status: PaymentStatus;
  txHash?: string | null;
  timestamp: number;
}

export interface TrustRecord {
  paymentCount: number;
  totalPaid: number;
  averageAmount: number;
  lastOutcome: PaymentStatus | string;
}

export interface DatabaseSchema {
  payments: Payment[];
  trustRecords: Record<string, TrustRecord>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default DB location: server/data/db.json (relative to server package root)
export const DEFAULT_DB_PATH = path.resolve(__dirname, "../../data/db.json");
export const DB_FILE_PATH = process.env.DB_FILE_PATH || DEFAULT_DB_PATH;

const defaultData: DatabaseSchema = {
  payments: [],
  trustRecords: {},
};

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let dbInstance: Low<DatabaseSchema> | null = null;

/**
 * Get or initialize the lowdb singleton instance.
 */
export async function getDb(customPath?: string): Promise<Low<DatabaseSchema>> {
  if (customPath) {
    ensureDirectoryExists(customPath);
    const adapter = new JSONFile<DatabaseSchema>(customPath);
    const db = new Low<DatabaseSchema>(adapter, { payments: [], trustRecords: {} });
    await db.read();
    if (!db.data) {
      db.data = { payments: [], trustRecords: {} };
    } else {
      db.data.payments = db.data.payments || [];
      db.data.trustRecords = db.data.trustRecords || {};
    }
    if (!fs.existsSync(customPath)) {
      await db.write();
    }
    return db;
  }

  if (!dbInstance) {
    const targetPath = DB_FILE_PATH;
    ensureDirectoryExists(targetPath);
    const adapter = new JSONFile<DatabaseSchema>(targetPath);
    dbInstance = new Low<DatabaseSchema>(adapter, defaultData);
    await dbInstance.read();
    if (!dbInstance.data) {
      dbInstance.data = { payments: [], trustRecords: {} };
    } else {
      dbInstance.data.payments = dbInstance.data.payments || [];
      dbInstance.data.trustRecords = dbInstance.data.trustRecords || {};
    }
    if (!fs.existsSync(targetPath)) {
      await dbInstance.write();
    }
  }

  return dbInstance;
}

/**
 * Reset internal db instance (primarily for tests).
 */
export function resetDbInstance(): void {
  dbInstance = null;
}

// ---------------------------------------------------------------------------
// Payments Collection Read / Write
// ---------------------------------------------------------------------------

/**
 * Read all payments from the store.
 */
export async function getPayments(): Promise<Payment[]> {
  const db = await getDb();
  await db.read();
  return db.data.payments;
}

export const readPayments = getPayments;

/**
 * Find a payment by its id.
 */
export async function getPaymentById(id: string): Promise<Payment | undefined> {
  const payments = await getPayments();
  return payments.find((p) => p.id === id);
}

export const getPayment = getPaymentById;
export const readPaymentById = getPaymentById;

/**
 * Find payments for a specific counterparty.
 */
export async function getPaymentsByCounterparty(
  counterpartyId: string
): Promise<Payment[]> {
  const payments = await getPayments();
  return payments.filter((p) => p.counterpartyId === counterpartyId);
}

/**
 * Find payments initiated by a specific agent.
 */
export async function getPaymentsByFromAgent(
  fromAgentId: string
): Promise<Payment[]> {
  const payments = await getPayments();
  return payments.filter((p) => p.fromAgentId === fromAgentId);
}

/**
 * Add or update a payment in the store.
 */
export async function savePayment(payment: Payment): Promise<Payment> {
  const db = await getDb();
  await db.read();

  const existingIndex = db.data.payments.findIndex((p) => p.id === payment.id);
  if (existingIndex >= 0) {
    db.data.payments[existingIndex] = payment;
  } else {
    db.data.payments.push(payment);
  }

  await db.write();
  return payment;
}

export const addPayment = savePayment;
export const writePayment = savePayment;

/**
 * Update partial fields of an existing payment.
 */
export async function updatePayment(
  id: string,
  updates: Partial<Payment>
): Promise<Payment | undefined> {
  const db = await getDb();
  await db.read();

  const payment = db.data.payments.find((p) => p.id === id);
  if (!payment) {
    return undefined;
  }

  Object.assign(payment, updates);
  await db.write();
  return payment;
}

/**
 * Convenience method to update payment status and txHash.
 */
export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  txHash?: string | null
): Promise<Payment | undefined> {
  return updatePayment(id, {
    status,
    ...(txHash !== undefined ? { txHash } : {}),
  });
}

/**
 * Overwrite the entire payments collection.
 */
export async function writePayments(payments: Payment[]): Promise<Payment[]> {
  const db = await getDb();
  await db.read();
  db.data.payments = payments;
  await db.write();
  return db.data.payments;
}

export const savePayments = writePayments;

// ---------------------------------------------------------------------------
// TrustRecords Collection Read / Write
// ---------------------------------------------------------------------------

/**
 * Read all trust records (keyed by counterpartyId).
 */
export async function getTrustRecords(): Promise<Record<string, TrustRecord>> {
  const db = await getDb();
  await db.read();
  return db.data.trustRecords;
}

export const readTrustRecords = getTrustRecords;

/**
 * Read the trust record for a single counterparty.
 */
export async function getTrustRecord(
  counterpartyId: string
): Promise<TrustRecord | undefined> {
  const records = await getTrustRecords();
  return records[counterpartyId];
}

export const readTrustRecord = getTrustRecord;

/**
 * Write/set the trust record for a single counterparty.
 */
export async function setTrustRecord(
  counterpartyId: string,
  record: TrustRecord
): Promise<TrustRecord> {
  const db = await getDb();
  await db.read();
  db.data.trustRecords[counterpartyId] = record;
  await db.write();
  return record;
}

export const saveTrustRecord = setTrustRecord;
export const writeTrustRecord = setTrustRecord;

/**
 * Update partial fields on a counterparty's trust record (creates default if not existing).
 */
export async function updateTrustRecord(
  counterpartyId: string,
  updates: Partial<TrustRecord>
): Promise<TrustRecord> {
  const db = await getDb();
  await db.read();

  const existing = db.data.trustRecords[counterpartyId] || {
    paymentCount: 0,
    totalPaid: 0,
    averageAmount: 0,
    lastOutcome: "paid",
  };

  const updated: TrustRecord = {
    ...existing,
    ...updates,
  };

  db.data.trustRecords[counterpartyId] = updated;
  await db.write();
  return updated;
}

/**
 * Overwrite the entire trustRecords collection.
 */
export async function writeTrustRecords(
  records: Record<string, TrustRecord>
): Promise<Record<string, TrustRecord>> {
  const db = await getDb();
  await db.read();
  db.data.trustRecords = records;
  await db.write();
  return db.data.trustRecords;
}

export const saveTrustRecords = writeTrustRecords;
