const FALLBACK_SUPABASE_URL = "https://ilzelezljkwajecesray.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_RtoLsIsVnFyh_oCBkvTyuQ_Qopj2rY6";

export const SUPABASE_PUBLIC_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;
