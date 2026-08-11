import type {
  AffiliateCommission,
  AffiliateDashboard,
  AffiliateLink,
  AffiliateProfile,
  CommissionProcessingResult,
} from "../domain/affiliate";

export interface AffiliateSession {
  currentUserId(): Promise<string | null>;
}

export interface AffiliateRepository {
  findActiveProfile(userId: string): Promise<AffiliateProfile | null>;
  listLinks(userId: string): Promise<readonly AffiliateLink[]>;
  createLink(userId: string, code: string, destinationPath: string, campaign: string | null): Promise<AffiliateLink>;
  loadDashboard(userId: string, profile: AffiliateProfile): Promise<AffiliateDashboard>;
  listCommissions(userId: string): Promise<readonly AffiliateCommission[]>;
}

export interface CommissionRepository {
  processPaidOrder(orderId: string): Promise<CommissionProcessingResult>;
}

