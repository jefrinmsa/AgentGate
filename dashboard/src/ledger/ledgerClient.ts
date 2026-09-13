// Wraps Ledger's Device Management Kit (DMK) over WebHID/WebUSB — this only
// works in a browser, which is why it lives in the dashboard, not the
// server.
//
// connectDevice() -> establishes a session with the physical Ledger
// requestApproval({ counterparty, amount, description }) -> sends the
//   ERC-7730-described request to the device, returns approved/rejected
//
// TODO: implement using @ledgerhq/device-management-kit, referencing
// server/src/erc7730/agentPayment.descriptor.json for the display schema

export interface ResolvePaymentOptions {
  paymentId: string;
  approved: boolean;
  serverUrl?: string;
}

export interface ResolvePaymentResult {
  status: "paid" | "rejected";
  txHash?: string | null;
  payment: any;
}

/**
 * Resolves a frozen payment on the AgentGate server.
 * Both the live Ledger DMK flow and the device simulator dispatch to this endpoint.
 */
export async function resolvePayment({
  paymentId,
  approved,
  serverUrl,
}: ResolvePaymentOptions): Promise<ResolvePaymentResult> {
  const host = window.location.hostname || "localhost";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const baseUrl = serverUrl || `${protocol}//${host}:4000`;
  const url = `${baseUrl}/pay/${paymentId}/resolve`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ approved }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error || `Server responded with ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
