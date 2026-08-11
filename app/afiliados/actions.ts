"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createAffiliateService } from "../../modules/affiliates/infrastructure/affiliate-factory";

export async function submitAffiliateApplicationAction(formData:FormData){
  const service=createAffiliateService(await createServerSupabaseClient());
  await service.submitApplication({notes:formData.get("notes")});
  revalidatePath("/afiliados");
}
export async function createAffiliateLinkAction(formData:FormData){
  const client=await createServerSupabaseClient();
  const service=createAffiliateService(client,createAdminSupabaseClient());
  await service.createLink({code:formData.get("code")||undefined,destinationPath:formData.get("destinationPath"),campaign:formData.get("campaign")||null});
  revalidatePath("/afiliados/painel");
}
export async function reviewAffiliateApplicationAction(formData:FormData){
  const client=await createServerSupabaseClient();
  const service=createAffiliateService(client,createAdminSupabaseClient());
  await service.reviewApplication({applicationId:formData.get("applicationId"),decision:formData.get("decision"),reviewNotes:formData.get("reviewNotes")||null});
  revalidatePath("/admin/afiliados");
  redirect("/admin/afiliados");
}
