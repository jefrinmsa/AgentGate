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
