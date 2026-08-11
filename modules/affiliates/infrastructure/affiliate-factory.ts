import type { SupabaseClient } from "@supabase/supabase-js";
import { AffiliateService, CommissionService } from "../application/affiliate-service";
import { SupabaseAffiliateRepository, SupabaseAffiliateSession, SupabaseCommissionRepository } from "./supabase-affiliate-repository";

export function createAffiliateService(sessionClient:SupabaseClient,adminClient:SupabaseClient){
  return new AffiliateService(new SupabaseAffiliateSession(sessionClient),new SupabaseAffiliateRepository(sessionClient,adminClient));
}

export function createCommissionService(adminClient:SupabaseClient){
  return new CommissionService(new SupabaseCommissionRepository(adminClient));
}

