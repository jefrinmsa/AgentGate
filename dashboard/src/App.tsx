import React, { useEffect, useState, useRef } from "react";
import { PaymentEvent } from "./types.js";
import PaymentFeed from "./PaymentFeed.js";
import ApprovalModal from "./ApprovalModal.js";

type ConnectionState = "connecting" | "connected" | "disconnected";

export const App: React.FC = () => {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("connecting");
  const [selectedPayment, setSelectedPayment] = useState<PaymentEvent | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial payments from backend store
    const protocolHttp = window.location.protocol === "https:" ? "https:" : "http:";
    const host = window.location.hostname || "localhost";
    const httpUrl = `${protocolHttp}//${host}:4000/pay`;

    fetch(httpUrl)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !Array.isArray(data)) return;
        setEvents((prev) => {
          const map = new Map<string, PaymentEvent>();
          data.forEach((p: any) => {
            const id = p.id || p.paymentId;
            map.set(id, {
              type: p.status,
              paymentId: id,
              counterparty: p.counterpartyId || p.counterparty,
              counterpartyId: p.counterpartyId,
              amount: p.amountUsdc,
              amountUsdc: p.amountUsdc,
              description: p.description,
              txHash: p.txHash,
              riskBrief: p.riskBrief,
              timestamp: p.timestamp,
            });
          });
          // Merge with any real-time WS events already received
          prev.forEach((p) => map.set(p.paymentId, p));
          return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        });
      })
      .catch((err) => {
        console.warn("[dashboard] Note: Initial fetch to /pay failed:", err.message);
      });

    function connect() {
      if (!isMounted) return;

      const protocolWs = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocolWs}//${host}:4000`;

      console.log(`[dashboard] Connecting to AgentGate WebSocket at ${wsUrl}...`);
      setConnectionStatus("connecting");

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log("[dashboard] Connected to AgentGate WebSocket");
          setConnectionStatus("connected");
        };

        ws.onmessage = (messageEvent) => {
          if (!isMounted) return;
          try {
            const data: PaymentEvent = JSON.parse(messageEvent.data);
            console.log("[dashboard] WS event received:", data);

            if (data && data.type) {
              setEvents((prevEvents) => {
                // Check if this payment already exists (e.g., updating frozen -> resolved)
                const existingIndex = prevEvents.findIndex(
                  (p) => p.paymentId && data.paymentId && p.paymentId === data.paymentId
                );

                if (existingIndex >= 0) {
                  const copy = [...prevEvents];
                  copy[existingIndex] = {
                    ...copy[existingIndex],
                    ...data,
                    timestamp: data.timestamp || copy[existingIndex].timestamp,
                  };
                  return copy;
                }

                // Prepend new event to the top of the feed
                return [{ ...data, timestamp: data.timestamp || Date.now() }, ...prevEvents];
              });
            }
          } catch (err) {
            console.error("[dashboard] Failed to parse WebSocket message:", err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          console.warn("[dashboard] WebSocket closed. Reconnecting in 3s...");
          setConnectionStatus("connecting");
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
          if (!isMounted) return;
          console.error("[dashboard] WebSocket encountered error:", err);
          setConnectionStatus("disconnected");
        };
      } catch (err) {
        console.error("[dashboard] Error establishing WebSocket:", err);
        setConnectionStatus("disconnected");
        reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="app-layout">
      {/* Top Brand Header */}
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-icon" aria-hidden="true">
            ⛩️
          </div>
          <div className="brand-info">
            <h1 className="brand-title">AgentGate</h1>
            <p className="brand-tagline">
              Autonomous Agent Payment Firewall & Human-in-the-Loop Gateway
            </p>
          </div>
        </div>

        {/* Live WebSocket Status Pill */}
        <div className="connection-status" aria-live="polite">
          <span className={`status-dot ${connectionStatus}`} aria-hidden="true" />
          <span className="status-text">
            {connectionStatus === "connected" && "Feed Connected (ws://:4000)"}
            {connectionStatus === "connecting" && "Connecting to Gateway..."}
            {connectionStatus === "disconnected" && "Offline (Retrying...)"}
          </span>
        </div>
      </header>

      {/* Main Payment Feed (Stat cards + transaction rows) */}
      <main>
        <PaymentFeed
          events={events}
          onSelectFrozen={(payment) => setSelectedPayment(payment)}
        />
      </main>

      {/* Approval Modal for Frozen Payments */}
      {selectedPayment && (
        <ApprovalModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onApprove={(payment) => {
            console.log("[dashboard] Reviewing payment with Ledger:", payment);
            // Will integrate with ledgerClient in upcoming steps
            alert(`Reviewing payment ${payment.paymentId} on physical Ledger device.`);
            setSelectedPayment(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
