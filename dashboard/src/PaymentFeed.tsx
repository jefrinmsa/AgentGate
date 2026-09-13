import React from "react";
import { PaymentEvent } from "./types.js";

export interface PaymentFeedProps {
  events: PaymentEvent[];
  onSelectFrozen?: (payment: PaymentEvent) => void;
}

function formatAddress(addr?: string): string {
  if (!addr) return "Unknown Address";
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatAmount(amt?: number | string): string {
  const num = Number(amt || 0);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return "Just now";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const PaymentFeed: React.FC<PaymentFeedProps> = ({ events, onSelectFrozen }) => {
  // Compute summary stats
  const autoPaidEvents = events.filter((e) => e.type === "paid" || (e.type === "resolved" && e.approved));
  const frozenEvents = events.filter((e) => e.type === "frozen");

  const autoPaidCount = autoPaidEvents.length;
  const frozenCount = frozenEvents.length;

  const totalSettledUsdc = autoPaidEvents.reduce((acc, curr) => {
    const val = Number(curr.amountUsdc ?? curr.amount ?? 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <div className="payment-feed-container">
      {/* 1. Three Small Stat Cards at the Top */}
      <section className="stats-grid" aria-label="Summary Statistics">
        <div className="stat-card auto-paid">
          <div className="stat-info">
            <div className="stat-label">Auto-Paid Count</div>
            <div className="stat-value">{autoPaidCount}</div>
          </div>
          <div className="stat-icon-wrapper" aria-hidden="true">
            ⚡
          </div>
        </div>

        <div className="stat-card frozen">
          <div className="stat-info">
            <div className="stat-label">Frozen Count</div>
            <div className="stat-value">{frozenCount}</div>
          </div>
          <div className="stat-icon-wrapper" aria-hidden="true">
            🛡️
          </div>
        </div>

        <div className="stat-card total-settled">
          <div className="stat-info">
            <div className="stat-label">Total Settled</div>
            <div className="stat-value">${formatAmount(totalSettledUsdc)}</div>
          </div>
          <div className="stat-icon-wrapper" aria-hidden="true">
            💵
          </div>
        </div>
      </section>

      {/* 2. Feed Section Header */}
      <section className="feed-header">
        <div className="feed-title-group">
          <h2 className="feed-title">Live Payment Feed</h2>
          <span className="feed-count-pill">{events.length} events</span>
        </div>
        <div className="feed-subtitle">
          Real-time AI agent transactions gated by AgentGate policy engine
        </div>
      </section>

      {/* 3. List of Rows */}
      <section className="feed-list" aria-label="Transaction Feed">
        {events.length === 0 ? (
          <div className="feed-empty">
            <div className="empty-icon">📡</div>
            <h3 className="empty-title">Waiting for Agent Payments</h3>
            <p className="empty-desc">
              Connected to AgentGate WebSocket. Transactions initiated by autonomous agents will stream
              here in real time.
            </p>
          </div>
        ) : (
          events.map((event, idx) => {
            const isPaid = event.type === "paid";
            const isFrozen = event.type === "frozen";
            const isResolved = event.type === "resolved";
            const counterparty = event.counterparty || event.counterpartyId || "Unknown Vendor";
            const amount = event.amountUsdc ?? event.amount;
            const rowClass = isFrozen
              ? "feed-row row-frozen animate-new"
              : isPaid
              ? "feed-row row-paid animate-new"
              : "feed-row row-resolved animate-new";

            return (
              <article
                key={event.paymentId || `evt-${idx}-${event.timestamp}`}
                className={rowClass}
                onClick={() => {
                  if (isFrozen && onSelectFrozen) {
                    onSelectFrozen(event);
                  }
                }}
                tabIndex={isFrozen ? 0 : undefined}
                role={isFrozen ? "button" : undefined}
                aria-label={
                  isFrozen
                    ? `Frozen payment of ${amount} USDC to ${counterparty}. Click to review.`
                    : `Payment of ${amount} USDC to ${counterparty}`
                }
              >
                {/* Main Row Overview */}
                <div className="row-main-content">
                  <div className="row-left-info">
                    <div className="vendor-details">
                      <div className="vendor-title">
                        <span>{formatAddress(counterparty)}</span>
                        {event.txHash && (
                          <a
                            href={`#tx-${event.txHash}`}
                            className="tx-hash-link"
                            title={`Transaction: ${event.txHash}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            tx: {event.txHash.slice(0, 10)}...
                          </a>
                        )}
                      </div>
                      <div className="payment-description">
                        {event.description || "Agent transaction request"}
                      </div>
                    </div>
                  </div>

                  <div className="row-right-info">
                    <span className="payment-amount">
                      {isPaid ? `+$${formatAmount(amount)} USDC` : `$${formatAmount(amount)} USDC`}
                    </span>

                    {isPaid && <span className="status-tag">Auto-Paid</span>}
                    {isFrozen && <span className="status-tag">Frozen</span>}
                    {isResolved && (
                      <span className="status-tag">
                        {event.approved ? "Resolved (Approved)" : "Rejected"}
                      </span>
                    )}

                    <span className="time-ago">{formatTime(event.timestamp)}</span>
                  </div>
                </div>

                {/* Risk Brief Subtitle for Frozen Rows */}
                {isFrozen && (
                  <div className="risk-brief-box">
                    <span className="risk-icon" aria-hidden="true">
                      ⚠️
                    </span>
                    <div className="risk-content">
                      <div className="risk-text">
                        {event.riskBrief ||
                          "Payment flagged for manual review: amount exceeds trust threshold."}
                      </div>
                      <span className="review-cue">Click to review on Ledger device →</span>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
};

export default PaymentFeed;
