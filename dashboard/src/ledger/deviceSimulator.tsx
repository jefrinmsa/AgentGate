import React, { useState } from "react";
import { PaymentEvent } from "../types.js";
import { resolvePayment } from "./ledgerClient.js";

export interface DeviceSimulatorProps {
  payment: PaymentEvent;
  onResolved?: (payment: PaymentEvent, approved: boolean) => void;
  onCancel?: () => void;
}

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({
  payment,
  onResolved,
  onCancel,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<"paid" | "rejected" | null>(null);

  const recipient = payment.counterparty || payment.counterpartyId || "0x0000000000000000000000000000000000000000";
  const rawAmount = payment.amountUsdc ?? payment.amount ?? 0;
  const formattedAmount = Number(rawAmount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleDecision = async (approved: boolean) => {
    setError(null);
    setIsSubmitting(true);

    try {
      console.log(`[deviceSimulator] Sending resolution for payment ${payment.paymentId}: approved=${approved}`);
      await resolvePayment({
        paymentId: payment.paymentId,
        approved,
      });

      setResolutionStatus(approved ? "paid" : "rejected");

      if (onResolved) {
        onResolved(payment, approved);
      }
    } catch (err: any) {
      console.error("[deviceSimulator] Failed to resolve payment:", err);
      setError(err?.message || "Failed to submit resolution to server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="device-simulator-container">
      {/* Physical Device Frame (Ledger Hardware Simulator) */}
      <div className="device-chassis" role="region" aria-label="Ledger Hardware Simulator">
        {/* Device Top Bezel / Status Bar */}
        <div className="device-top-bar">
          <div className="device-brand-badge">
            <span className="device-brand-name">LEDGER</span>
            <span className="device-dot-active" title="Device Connected (Simulated)" />
          </div>
          <div className="device-mode-pill">ERC-7730 CLEAR-SIGN</div>
        </div>

        {/* OLED / E-Ink Display Screen Area */}
        <div className="device-screen">
          {resolutionStatus ? (
            <div className={`screen-outcome-state outcome-${resolutionStatus}`}>
              <div className="outcome-icon" aria-hidden="true">
                {resolutionStatus === "paid" ? "✓" : "✕"}
              </div>
              <div className="outcome-title">
                {resolutionStatus === "paid" ? "Transaction Approved" : "Transaction Rejected"}
              </div>
              <div className="outcome-desc">
                {resolutionStatus === "paid"
                  ? "Signed on Arc Testnet & broadcasted to AgentGate gateway."
                  : "Halted & logged to policy engine."}
              </div>
              {onCancel && (
                <button className="device-btn-dismiss" onClick={onCancel}>
                  Close Simulator
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Intent Header (matches ERC-7730 format intent: 'Agent payment') */}
              <div className="screen-header">
                <span className="screen-intent-badge">INTENT</span>
                <h4 className="screen-intent-title">Agent payment</h4>
                <div className="screen-chain-tag">Arc Testnet (5042002)</div>
              </div>

              {/* Clear-Signing Fields Area (matches ERC-7730 fields) */}
              <div className="screen-fields">
                {/* Field 1: Paying (to) */}
                <div className="screen-field-row">
                  <div className="screen-field-label">Paying</div>
                  <div className="screen-field-value mono-address" title={recipient}>
                    {recipient}
                  </div>
                </div>

                {/* Field 2: Amount (tokenAmount USDC) */}
                <div className="screen-field-row">
                  <div className="screen-field-label">Amount</div>
                  <div className="screen-field-value amount-highlight">
                    {formattedAmount} <span className="screen-token-symbol">USDC</span>
                  </div>
                </div>

                {/* Contract Context (from descriptor context deployments) */}
                <div className="screen-context-row">
                  <span className="context-label">Token Contract:</span>
                  <span className="context-value mono">0x3600...0000</span>
                </div>
              </div>

              {/* Status or Error Banner inside Screen */}
              {isSubmitting && (
                <div className="screen-busy-overlay">
                  <div className="screen-spinner" />
                  <span>Signing & resolving on gateway...</span>
                </div>
              )}

              {error && (
                <div className="screen-error-box">
                  <span className="error-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Physical Hardware Buttons below screen */}
        {!resolutionStatus && (
          <div className="device-actions">
            <button
              className="device-btn device-btn-reject"
              disabled={isSubmitting}
              onClick={() => handleDecision(false)}
              aria-label="Reject payment"
            >
              <span className="btn-icon">✕</span> Reject
            </button>
            <button
              className="device-btn device-btn-approve"
              disabled={isSubmitting}
              onClick={() => handleDecision(true)}
              aria-label="Approve payment"
            >
              <span className="btn-icon">✓</span> Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceSimulator;
