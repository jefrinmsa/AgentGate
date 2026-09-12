# Architecture

Agent -> middleware.payWithGate() -> POST /pay on server
                                        |
                                  policy/trustScore.ts   (has this counterparty paid before? how much do we trust them?)
                                  policy/anomalyCheck.ts (is this amount/pattern out of the ordinary?)
                                        |
                     ---------------------------------------------
                     |                                           |
              under ceiling                                 flagged
                     |                                           |
        payments/arcTransfer.ts                     policy/riskBrief.ts (LLM writes plain-English summary)
        (executes USDC transfer)                                |
                     |                              ws.ts pushes "frozen" event to dashboard
              ws.ts pushes "paid" event                          |
                     |                              dashboard/ApprovalModal.tsx shows it
              dashboard/PaymentFeed.tsx                          |
                                                    dashboard/ledger/ledgerClient.ts
                                                    (ERC-7730 clear-signed request to device)
                                                                  |
                                                    human approves/rejects on Ledger
                                                                  |
                                                    if approved -> payments/arcTransfer.ts
                                                    trust score updated either way

## Key decision: policy logic is off-chain

The trust score, anomaly check, and freeze/auto-pay decision all live in a
normal backend service (server/), not a smart contract. This is faster to
build and change under a 4-day deadline. The only on-chain activity is the
actual USDC transfer on Arc plus (optionally) writing payment history to a
contract later if there's time — not required for the core demo.
