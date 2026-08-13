# Affiliate Wallet

The Wallet is an immutable financial ledger derived from affiliate commissions. It exposes pending, available and paid balances, a chronological statement and Pix payout requests.

- Commissions enter as pending and only an administrator can release them.
- A payout request atomically reserves available balance, preventing double spending.
- Pix keys are encrypted at rest and only a masked value is readable by the affiliate.
- Paid or rejected payouts create compensating entries; ledger rows are never edited.
- No release deadline or minimum payout is assumed until the commercial policy is approved.

## Financial administration

The /admin/financeiro route lists pending commissions, payout requests and processed payout history. Every read and mutation revalidates the authenticated user as an administrator. The full Pix destination is decrypted only in the server-side administrative flow; affiliates see only its masked form.
