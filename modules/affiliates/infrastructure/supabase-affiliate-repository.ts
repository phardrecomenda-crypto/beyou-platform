import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AffiliateError, type AffiliateApplication, type AffiliateApplicationReview, type AffiliateCommission, type AffiliateLink, type AffiliateProfile, type CommissionProcessingResult } from "../domain/affiliate";
import type { AffiliateRepository, AffiliateSession, CommissionRepository } from "../application/affiliate-repository";

type ProfileRow={user_id:string;affiliate_code:string;focus:AffiliateProfile["focus"];active:boolean};
type LinkRow={id:string;code:string;destination_path:string;campaign:string|null;active:boolean;created_at:string};
type CommissionRow={id:string;order_id:string|null;commission_type:string;percentage:number|string|null;base_amount:number|string;amount:number|string;status:AffiliateCommission["status"];created_at:string};
type EngineRow={status:"PROCESSED"|"NO_ATTRIBUTION";affiliate_entries?:number;company_entries?:number;attribution_type?:"DIRECT"|"REMARKETING";base_amount?:number|string};
type ApplicationRow={id:string;user_id:string;status:AffiliateApplication["status"];notes:string|null;review_notes:string|null;reviewed_at:string|null;created_at:string};

const mapProfile=(row:ProfileRow):AffiliateProfile=>({userId:row.user_id,affiliateCode:row.affiliate_code,focus:row.focus,active:row.active});
const mapLink=(row:LinkRow):AffiliateLink=>({id:row.id,code:row.code,destinationPath:row.destination_path,campaign:row.campaign,active:row.active,createdAt:row.created_at});
const mapCommission=(row:CommissionRow):AffiliateCommission=>({id:row.id,orderId:row.order_id,type:row.commission_type,percentage:row.percentage===null?null:Number(row.percentage),baseAmount:Number(row.base_amount),amount:Number(row.amount),status:row.status,createdAt:row.created_at});
const mapApplication=(row:ApplicationRow):AffiliateApplication=>({id:row.id,userId:row.user_id,status:row.status,notes:row.notes,reviewNotes:row.review_notes,reviewedAt:row.reviewed_at,createdAt:row.created_at});
const applicationFields="id, user_id, status, notes, review_notes, reviewed_at, created_at";

export class SupabaseAffiliateSession implements AffiliateSession {
  constructor(private readonly client:SupabaseClient) {}
  async currentUserId(){const {data,error}=await this.client.auth.getUser();if(error) throw error;return data.user?.id??null;}
}

export class SupabaseAffiliateRepository implements AffiliateRepository {
  constructor(private readonly readClient:SupabaseClient,private readonly adminClient:SupabaseClient) {}

  async findActiveProfile(userId:string){
    const {data,error}=await this.readClient.from("affiliate_profiles").select("user_id, affiliate_code, focus, active").eq("user_id",userId).eq("active",true).maybeSingle();
    if(error) throw error; return data?mapProfile(data as ProfileRow):null;
  }
  async listLinks(userId:string){
    const {data,error}=await this.readClient.from("affiliate_links").select("id, code, destination_path, campaign, active, created_at").eq("affiliate_user_id",userId).order("created_at",{ascending:false});
    if(error) throw error; return (data??[]).map(row=>mapLink(row as LinkRow));
  }
  async createLink(userId:string,code:string,destinationPath:string,campaign:string|null){
    const {data,error}=await this.adminClient.from("affiliate_links").insert({affiliate_user_id:userId,code,destination_path:destinationPath,campaign}).select("id, code, destination_path, campaign, active, created_at").single();
    if(error?.code==="23505") throw new AffiliateError("CODE_UNAVAILABLE");
    if(error) throw error; return mapLink(data as LinkRow);
  }
  async listCommissions(userId:string){
    const {data,error}=await this.readClient.from("commission_ledger").select("id, order_id, commission_type, percentage, base_amount, amount, status, created_at").eq("affiliate_user_id",userId).order("created_at",{ascending:false}).limit(100);
    if(error) throw error; return (data??[]).map(row=>mapCommission(row as CommissionRow));
  }
  async loadDashboard(userId:string,profile:AffiliateProfile){
    const [linksResult,networkResult,commissions]=await Promise.all([
      this.readClient.from("affiliate_links").select("id",{count:"exact",head:true}).eq("affiliate_user_id",userId).eq("active",true),
      this.readClient.from("affiliate_network").select("id",{count:"exact",head:true}).eq("owner_user_id",userId).eq("active",true),
      this.listCommissions(userId),
    ]);
    if(linksResult.error) throw linksResult.error;if(networkResult.error) throw networkResult.error;
    const sum=(statuses:readonly string[])=>commissions.filter(item=>statuses.includes(item.status)).reduce((total,item)=>total+item.amount,0);
    return {profile,activeLinks:linksResult.count??0,networkMembers:networkResult.count??0,pendingAmount:sum(["calculated","pending"]),releasedAmount:sum(["released"]),paidAmount:sum(["paid"]),recentCommissions:commissions.slice(0,20)};
  }

  async findApplication(userId:string){
    const {data,error}=await this.readClient.from("affiliate_applications").select(applicationFields).eq("user_id",userId).maybeSingle();
    if(error) throw error; return data?mapApplication(data as ApplicationRow):null;
  }
  async submitApplication(userId:string,notes:string|null){
    const {data,error}=await this.readClient.from("affiliate_applications").insert({user_id:userId,requested_role:"affiliate",status:"pending",notes}).select(applicationFields).single();
    if(error?.code==="23505") throw new AffiliateError("APPLICATION_EXISTS");
    if(error) throw error; return mapApplication(data as ApplicationRow);
  }
  async isAdministrator(userId:string){
    const {data,error}=await this.adminClient.from("profiles").select("role").eq("id",userId).maybeSingle();
    if(error) throw error; return data?.role==="admin";
  }
  async listPendingApplications(){
    const {data,error}=await this.adminClient.from("affiliate_applications").select(applicationFields).eq("status","pending").order("created_at");
    if(error) throw error;
    const applications=(data??[]).map(row=>mapApplication(row as ApplicationRow));
    if(!applications.length) return applications;
    const {data:profiles,error:profilesError}=await this.adminClient.from("profiles").select("id, full_name").in("id",applications.map(item=>item.userId));
    if(profilesError) throw profilesError;
    const names=new Map((profiles??[]).map(row=>[row.id as string,row.full_name as string]));
    return applications.map(item=>({...item,applicantName:names.get(item.userId)??"Cliente BEYOU"}));
  }
  async reviewApplication(applicationId:string,reviewerId:string,decision:"approved"|"rejected",reviewNotes:string|null):Promise<AffiliateApplicationReview>{
    const {data,error}=await this.adminClient.rpc("review_affiliate_application",{p_application_id:applicationId,p_reviewer_id:reviewerId,p_decision:decision,p_review_notes:reviewNotes});
    if(error?.message?.includes("APPLICATION_ALREADY_REVIEWED")) throw new AffiliateError("APPLICATION_ALREADY_REVIEWED");
    if(error?.message?.includes("APPLICATION_NOT_FOUND")) throw new AffiliateError("APPLICATION_NOT_FOUND");
    if(error) throw error;
    const row=data as {status:"approved"|"rejected";application_id:string;affiliate_user_id?:string;affiliate_code?:string};
    return {status:row.status,applicationId:row.application_id,affiliateUserId:row.affiliate_user_id,affiliateCode:row.affiliate_code};
  }
}

export class SupabaseCommissionRepository implements CommissionRepository {
  constructor(private readonly adminClient:SupabaseClient) {}
  async processPaidOrder(orderId:string):Promise<CommissionProcessingResult>{
    const {data,error}=await this.adminClient.rpc("generate_affiliate_commissions",{p_order_id:orderId});
    if(error) throw error;const row=data as EngineRow;
    return {status:row.status,affiliateEntries:row.affiliate_entries??0,companyEntries:row.company_entries??0,attributionType:row.attribution_type,baseAmount:row.base_amount===undefined?undefined:Number(row.base_amount)};
  }
}
