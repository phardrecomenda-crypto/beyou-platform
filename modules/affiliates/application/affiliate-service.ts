import { z } from "zod";
import { AffiliateError } from "../domain/affiliate";
import type { AffiliateRepository, AffiliateSession, CommissionRepository } from "./affiliate-repository";

const linkSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,47}$/).optional(),
  destinationPath: z.string().trim().regex(/^\/(?!\/)/).max(240).default("/loja"),
  campaign: z.string().trim().min(1).max(80).nullable().optional(),
});
const uuidSchema = z.string().uuid();
const applicationSchema = z.object({
  notes: z.string().trim().min(20).max(1000),
});
const reviewSchema = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().trim().max(1000).nullable().optional(),
});

const normalizeCode = (value: string) => value
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9_-]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 40);

export class AffiliateService {
  constructor(private readonly session: AffiliateSession, private readonly repository: AffiliateRepository) {}

  private async requireAffiliate() {
    const userId = await this.session.currentUserId();
    if (!userId) throw new AffiliateError("AUTHENTICATION_REQUIRED");
    const profile = await this.repository.findActiveProfile(userId);
    if (!profile) throw new AffiliateError("AFFILIATE_NOT_ACTIVE");
    return { userId, profile };
  }

  async dashboard() {
    const { userId, profile } = await this.requireAffiliate();
    return this.repository.loadDashboard(userId, profile);
  }

  async links() {
    const { userId } = await this.requireAffiliate();
    return this.repository.listLinks(userId);
  }

  async createLink(input: unknown) {
    const parsed = linkSchema.safeParse(input);
    if (!parsed.success) throw new AffiliateError("LINK_INVALID");
    const { userId, profile } = await this.requireAffiliate();
    const code = parsed.data.code ?? normalizeCode(profile.affiliateCode);
    if (code.length < 3) throw new AffiliateError("LINK_INVALID");
    return this.repository.createLink(
      userId, code, parsed.data.destinationPath, parsed.data.campaign ?? null,
    );
  }

  async application() {
    const userId = await this.session.currentUserId();
    if (!userId) throw new AffiliateError("AUTHENTICATION_REQUIRED");
    return this.repository.findApplication(userId);
  }

  async submitApplication(input: unknown) {
    const parsed = applicationSchema.safeParse(input);
    if (!parsed.success) throw new AffiliateError("APPLICATION_INVALID");
    const userId = await this.session.currentUserId();
    if (!userId) throw new AffiliateError("AUTHENTICATION_REQUIRED");
    if (await this.repository.findApplication(userId)) throw new AffiliateError("APPLICATION_EXISTS");
    return this.repository.submitApplication(userId, parsed.data.notes);
  }

  async pendingApplications() {
    const userId = await this.session.currentUserId();
    if (!userId) throw new AffiliateError("AUTHENTICATION_REQUIRED");
    if (!await this.repository.isAdministrator(userId)) throw new AffiliateError("ADMIN_REQUIRED");
    return this.repository.listPendingApplications();
  }

  async reviewApplication(input: unknown) {
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) throw new AffiliateError("APPLICATION_INVALID");
    const userId = await this.session.currentUserId();
    if (!userId) throw new AffiliateError("AUTHENTICATION_REQUIRED");
    if (!await this.repository.isAdministrator(userId)) throw new AffiliateError("ADMIN_REQUIRED");
    return this.repository.reviewApplication(
      parsed.data.applicationId,
      userId,
      parsed.data.decision,
      parsed.data.reviewNotes ?? null,
    );
  }
}

export class CommissionService {
  constructor(private readonly repository: CommissionRepository) {}

  async processConfirmedOrder(orderId: string) {
    if (!uuidSchema.safeParse(orderId).success) throw new AffiliateError("ORDER_INVALID");
    return this.repository.processPaidOrder(orderId);
  }
}
