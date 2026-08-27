import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qtaxuzubejquqfeflsjy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0YXh1enViZWpxdXFmZWZsc2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NjEzODIsImV4cCI6MjEwMzQzNzM4Mn0.s1xuHpN5CsKWX-W6xSibUHA66ZMwuhctaj_YvBDAHXI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
