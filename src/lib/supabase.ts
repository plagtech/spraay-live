import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type GatewayEvent = {
  id: string;
  created_at: string;
  event_type: "scan" | "intent" | "payment";
  path: string;
  method: string | null;
  http_status: number | null;
  category: string | null;
  chain: string | null;
  endpoint_name: string | null;
  payer_truncated: string | null;
  batch_size: number | null;
  scanner_source: string | null;
  user_agent: string | null;
  payment_attempted: boolean;
  source_ip_truncated: string | null;
};