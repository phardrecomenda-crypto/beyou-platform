"use server";
import{revalidatePath}from"next/cache";
import{z}from"zod";
import{createAdminSupabaseClient}from"../../../lib/supabase/admin";
import{createServerSupabaseClient}from"../../../lib/supabase/server";
const schema=z.object({ownerUserId:z.string().uuid(),memberUserId:z.string().uuid(),parentUserId:z.union([z.string().uuid(),z.literal("")]).optional(),level:z.enum(["n1","n2","n3"]),relationshipType:z.enum(["manager","recruiter"]),active:z.enum(["true","false"]).default("true")});
export async function saveNetworkMemberAction(formData:FormData){const input=schema.parse(Object.fromEntries(formData)),session=await createServerSupabaseClient(),{data:{user}}=await session.auth.getUser();if(!user)throw new Error("AUTHENTICATION_REQUIRED");const{error}=await createAdminSupabaseClient().rpc("manage_affiliate_network_member",{p_actor_id:user.id,p_owner_user_id:input.ownerUserId,p_member_user_id:input.memberUserId,p_parent_user_id:input.parentUserId||null,p_level:input.level,p_relationship_type:input.relationshipType,p_active:input.active==="true"});if(error)throw error;revalidatePath("/admin/rede");revalidatePath("/afiliados/painel")}
