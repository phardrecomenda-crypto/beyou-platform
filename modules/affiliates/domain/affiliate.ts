export type AffiliateFocus = "affiliate" | "manager" | "recruiter";
export type AttributionType = "DIRECT" | "REMARKETING";
export type AffiliateApplicationStatus = "pending" | "approved" | "rejected";
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

export type AffiliateApplication = Readonly<{
  id: string;
  userId: string;
  status: AffiliateApplicationStatus;
  notes: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  applicantName?: string;
}>;

export type AffiliateApplicationReview = Readonly<{
  status: "approved" | "rejected";
  applicationId: string;
  affiliateUserId?: string;
  affiliateCode?: string;
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
  network: readonly AffiliateNetworkMember[];
}>;

export type AffiliateNetworkMember = Readonly<{
  id: string;
  userId: string;
  name: string;
  parentUserId: string | null;
  level: "n1" | "n2" | "n3";
  relationshipType: AffiliateFocus;
  joinedAt: string;
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
  | "ORDER_INVALID"
  | "APPLICATION_INVALID"
  | "APPLICATION_EXISTS"
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_ALREADY_REVIEWED"
  | "ADMIN_REQUIRED";

export class AffiliateError extends Error {
  constructor(readonly code: AffiliateErrorCode) {
    super(code);
    this.name = "AffiliateError";
  }
}
