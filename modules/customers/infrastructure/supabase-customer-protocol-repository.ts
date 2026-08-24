import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomerCycle={id:string;cycleNumber:number;status:string;startedAt:string;completedAt:string|null};
export type CustomerCheckin={id:string;cadence:string;checkinDate:string;weightKg:number|null;moodScore:number;energyScore:number;sleepScore:number;hungerScore:number;waterLiters:number;exerciseMinutes:number;notes:string|null;createdAt:string};

export class SupabaseCustomerProtocolRepository{
 constructor(private client:SupabaseClient){}
 private async user(){const{data:{user},error}=await this.client.auth.getUser();if(error)throw error;if(!user)throw new Error("AUTHENTICATION_REQUIRED");return user}
 async load(){const user=await this.user();const[cycles,checkins]=await Promise.all([this.client.from("customer_cycles").select("id,cycle_number,status,started_at,completed_at").eq("user_id",user.id).order("cycle_number",{ascending:false}),this.client.from("customer_checkins").select("id,cadence,checkin_date,weight_kg,mood_score,energy_score,sleep_score,hunger_score,water_liters,exercise_minutes,notes,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40)]);if(cycles.error)throw cycles.error;if(checkins.error)throw checkins.error;return{cycles:(cycles.data??[]).map(x=>({id:x.id,cycleNumber:x.cycle_number,status:x.status,startedAt:x.started_at,completedAt:x.completed_at})),checkins:(checkins.data??[]).map(x=>({id:x.id,cadence:x.cadence,checkinDate:x.checkin_date,weightKg:x.weight_kg===null?null:Number(x.weight_kg),moodScore:x.mood_score,energyScore:x.energy_score,sleepScore:x.sleep_score,hungerScore:x.hunger_score,waterLiters:Number(x.water_liters),exerciseMinutes:x.exercise_minutes,notes:x.notes,createdAt:x.created_at}))}}
 async start(){const{error}=await this.client.rpc("start_customer_protocol");if(error)throw error}
 async checkin(answers:Record<string,unknown>){const{error}=await this.client.rpc("record_customer_checkin",{p_answers:answers});if(error)throw error}
}
