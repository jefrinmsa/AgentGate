# AgentGate

A spend firewall for AI agent payments. Trusted, small, repeated payments
between agents settle automatically in USDC on Arc. Anything unusual — a
new counterparty, an outsized invoice, a suspicious pattern — freezes and
is sent to a human for approval on a physical Ledger device, with a
plain-English explanation of what's being requested.

## Why

Autonomous agents that pay for compute, data, or API access today have two
bad options: unrestricted wallet access (one bad call drains it) or a human
approving every payment (which defeats the point of autonomy). AgentGate is
the middle: automatic for the routine 95%, hardware-verified human approval
for the risky 5%.

## Structure

- `server/` — the policy engine (the actual "firewall"): trust scoring,
  anomaly detection, risk-brief generation, and the Circle/Arc payment calls.
- `dashboard/` — browser UI: live payment feed + the Ledger approval flow
  (WebHID/WebUSB only works in a browser context, so this is where the
  device connection lives).
- `middleware/` — the drop-in wrapper other agent frameworks import to route
  their payments through AgentGate instead of paying directly.
- `demo-agent/` — a small example agent used for the live demo.
- `docs/` — architecture notes and a running log of Ledger SDK friction
  (worth including in the submission — Ledger judges this).

## Running locally

1. `cp server/.env.example server/.env` and fill in Circle API key + Arc RPC.
2. `npm install`
3. `npm run dev:server`
4. `npm run dev:dashboard` (separate terminal)
5. `npm run dev:demo` to fire test payments through the system.

## Status

Scaffold only — see TODOs in each file for what's still unimplemented.
