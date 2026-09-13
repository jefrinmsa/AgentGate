// The scripted "character" for your live demo. Fires a sequence of
// payments through payWithGate() that reliably reproduces both scenarios:
//
// 1. A few small payments to a "trusted" vendor -> auto-paid instantly
// 2. One payment to a brand-new / oversized vendor -> freezes, appears in
//    the dashboard, and requires the physical Ledger approval
//
// Keep this deterministic and scripted rather than "real" AI decision-making
// — for a demo, reliability beats cleverness. You can make it look
// autonomous in the pitch without leaving it to chance on stage.
//
// TODO: implement using payWithGate() from @agentgate/middleware
