export type AffiliateFocus = "affiliate" | "manager" | "recruiter";
export type AttributionType = "DIRECT" | "REMARKETING";
export type CommissionStatus = "calculated" | "pending" | "released" | "paid" | "cancelled" | "reversed";

export type AffiliateProfile = Readonly<{
  userId: string;
  affiliateCode: string;
  focus: AffiliateFocus;
  active: boolean;
}>;

export type AffiliateLink = Readonly<{
  id: string;
  code: string;
  destinationPath: string;
  campaign: string | null;
  active: boolean;
  createdAt: string;
}>;

export type AffiliateCommission = Readonly<{
  id: string;
  orderId: string | null;
  type: string;
  percentage: number | null;
  baseAmount: number;
  amount: number;
  status: CommissionStatus;
  createdAt: string;
}>;

export type AffiliateDashboard = Readonly<{
  profile: AffiliateProfile;
  activeLinks: number;
  networkMembers: number;
  pendingAmount: number;
  releasedAmount: number;
  paidAmount: number;
  recentCommissions: readonly AffiliateCommission[];
}>;

export type CommissionProcessingResult = Readonly<{
  status: "PROCESSED" | "NO_ATTRIBUTION";
  affiliateEntries: number;
  companyEntries: number;
  attributionType?: AttributionType;
  baseAmount?: number;
}>;

export type AffiliateErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AFFILIATE_NOT_ACTIVE"
  | "LINK_INVALID"
  | "CODE_UNAVAILABLE"
  | "ORDER_INVALID";

export class AffiliateError extends Error {
  constructor(readonly code: AffiliateErrorCode) {
    super(code);
    this.name = "AffiliateError";
  }
}

