import React from "react";
import { PaymentEvent } from "./types.js";
import DeviceSimulator from "./ledger/deviceSimulator.js";

export interface ApprovalModalProps {
  payment: PaymentEvent | null;
  onClose: () => void;
  onApprove?: (payment: PaymentEvent) => void;
  onResolved?: (payment: PaymentEvent, approved: boolean) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  payment,
  onClose,
  onApprove,
  onResolved,
}) => {
  if (!payment) return null;

  const counterparty = payment.counterparty || payment.counterpartyId || "Unknown Counterparty";
  const amount = payment.amountUsdc ?? payment.amount;

  const handleResolved = (resolvedPayment: PaymentEvent, approved: boolean) => {
    if (onResolved) {
      onResolved(resolvedPayment, approved);
    }
    if (onApprove && approved) {
      onApprove(resolvedPayment);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Modal Header */}
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
            AgentGate policy engine halted this autonomous transaction. Review the AI risk brief and clear-sign using the Ledger device simulator.
          </p>
        </div>

        {/* Stand-in Environment Banner */}
        <div className="simulator-disclaimer-banner" role="note">
          <span className="disclaimer-icon" aria-hidden="true">
            📟
          </span>
          <span className="disclaimer-text">
            Device simulator (Ledger DMK integration implemented in ledgerClient.ts; live hardware/Speculos unavailable in this environment)
          </span>
        </div>

        {/* Modal Content Grid */}
        <div className="modal-split-layout">
          {/* Left Column: Transaction Details & AI Risk Brief */}
          <div className="modal-info-panel">
            <div className="panel-section-title">Transaction Details</div>
            <div className="modal-detail-row">
              <span className="detail-label">Counterparty</span>
              <span className="detail-value mono" title={counterparty}>
                {counterparty.length > 22
                  ? `${counterparty.slice(0, 10)}...${counterparty.slice(-8)}`
                  : counterparty}
              </span>
            </div>

            <div className="modal-detail-row">
              <span className="detail-label">Requested Amount</span>
              <span className="detail-value amount-alert">${amount} USDC</span>
            </div>

            <div className="modal-detail-row">
              <span className="detail-label">Description</span>
              <span className="detail-value">{payment.description || "Autonomous agent payment"}</span>
            </div>

            <div className="modal-risk-brief">
              <div className="risk-brief-header">
                <span className="risk-badge">AI Risk Assessment</span>
              </div>
              <p className="risk-brief-body">
                {payment.riskBrief ||
                  "Payment exceeds historical safety ceiling. No established trust history recorded for this counterparty."}
              </p>
            </div>
          </div>

          {/* Right Column: Ledger Device Simulator Frame */}
          <div className="modal-device-panel">
            <DeviceSimulator
              payment={payment}
              onResolved={handleResolved}
              onCancel={onClose}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
