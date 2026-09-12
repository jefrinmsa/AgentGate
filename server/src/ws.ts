// WebSocket server the dashboard connects to for live events:
// "paid" { counterparty, amount, txHash }
// "frozen" { counterparty, amount, riskBrief }
// "resolved" { counterparty, amount, approved, txHash? }
//
// TODO: implement using `ws`, broadcast from routes/payments.ts
