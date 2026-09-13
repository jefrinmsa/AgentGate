import React from "react";
import { PaymentEvent } from "./types.js";

export interface ApprovalModalProps {
  payment: PaymentEvent | null;
  onClose: () => void;
  onApprove?: (payment: PaymentEvent) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  payment,
  onClose,
  onApprove,
}) => {
  if (!payment) return null;

  const counterparty = payment.counterparty || payment.counterpartyId || "Unknown Counterparty";
  const amount = payment.amountUsdc ?? payment.amount;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div className="modal-badge-row">
            <span className="modal-status-badge">Requires Human Approval</span>
            <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>
          <h3 id="modal-title" className="modal-title">
            Review Flagged Payment
          </h3>
          <p className="modal-subtitle">
            AgentGate policy engine halted this transaction to prevent unauthorized fund outflow.
          </p>
        </div>

        <div className="modal-body">
          <div className="modal-detail-row">
            <span className="detail-label">Counterparty</span>
            <span className="detail-value mono">{counterparty}</span>
          </div>

          <div className="modal-detail-row">
            <span className="detail-label">Requested Amount</span>
            <span className="detail-value amount-alert">${amount} USDC</span>
          </div>

          <div className="modal-detail-row">
            <span className="detail-label">Description</span>
            <span className="detail-value">{payment.description || "N/A"}</span>
          </div>

          <div className="modal-risk-brief">
            <div className="risk-brief-header">
              <span className="risk-badge">AI Risk Assessment</span>
            </div>
            <p className="risk-brief-body">
              {payment.riskBrief ||
                "Payment exceeds historical safety ceiling. No trust history recorded for this counterparty."}
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Dismiss
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (onApprove) onApprove(payment);
            }}
          >
            Review on Ledger Device →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
