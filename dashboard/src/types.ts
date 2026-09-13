export type PaymentEventType = "paid" | "frozen" | "resolved" | string;

export interface PaymentEvent {
  type: PaymentEventType;
  paymentId: string;
  counterparty: string;
  counterpartyId?: string;
  amount: number;
  amountUsdc?: number;
  description?: string;
  txHash?: string | null;
  riskBrief?: string;
  reason?: string;
  approved?: boolean;
  timestamp: number;
}

export interface PaymentStats {
  autoPaidCount: number;
  frozenCount: number;
  totalSettled: number;
}
