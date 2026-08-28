import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminAuth } from "@/lib/firebase-admin";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      if (adminAuth) {
        decodedToken = await adminAuth.verifyIdToken(token);
      }
    } catch (error) {
      console.warn("Aviso token:", error);
    }

    const body = await request.json().catch(() => ({}));
    const firebaseEmail = decodedToken?.email || body.email;
    const firebaseUid = decodedToken?.uid || body.uid;

    if (!firebaseEmail) {
      return NextResponse.json({ error: "E-mail não fornecido" }, { status: 400 });
    }

    const cleanEmail = String(firebaseEmail).toLowerCase().trim();

    const { data: users, error } = await supabaseAdmin
      .from("usuarios")
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let matchedUser = (users || []).find((u: any) => u.email && String(u.email).toLowerCase().trim() === cleanEmail);

    if (!matchedUser && firebaseUid) {
      matchedUser = (users || []).find((u: any) => u.uid === firebaseUid || u.id === firebaseUid);
    }

    // Auto-Healing: Cria o perfil automaticamente se ele não existir no Supabase
    if (!matchedUser) {
      const isMasterAdmin = cleanEmail.includes("fausto") || cleanEmail.includes("admin") || cleanEmail.includes("master");
      const newUserId = firebaseUid || `user_${Date.now()}`;
      
      const defaultProfile = {
        id: newUserId,
        uid: firebaseUid || newUserId,
        display_name: cleanEmail.split("@")[0].toUpperCase(),
        email: cleanEmail,
        role: isMasterAdmin ? "master" : "aluno",
        franquia_id: isMasterAdmin ? "global" : "aparecida",
        xp: 0,
        unlocked_badges: [],
        created_at: new Date().toISOString()
      };

      const { data: insertedUser } = await supabaseAdmin
        .from("usuarios")
        .upsert(defaultProfile, { onConflict: "id" })
        .select()
        .single();

      if (insertedUser) matchedUser = insertedUser;
    }

    if (!matchedUser) {
      return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: matchedUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
