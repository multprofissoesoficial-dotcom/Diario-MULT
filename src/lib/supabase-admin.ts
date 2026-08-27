import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qtaxuzubejquqfeflsjy.supabase.co";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0YXh1enViZWpxdXFmZWZsc2p5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg2MTM4MiwiZXhwIjoyMTAzNDM3MzgyfQ.ZPtNuqud_A1t9-nieo5B230DnHgU64XT9DThgkJiOG4";

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
