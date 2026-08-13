export type WalletBalance={pending:number;available:number;paid:number};
export type WalletEntry={id:string;type:string;pendingDelta:number;availableDelta:number;paidDelta:number;createdAt:string};
export type PayoutRequest={id:string;amount:number;status:string;pixKeyMasked:string;requestedAt:string};
export type AffiliateWallet={balance:WalletBalance;entries:WalletEntry[];payouts:PayoutRequest[]};
