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
      console.warn("Aviso de verificação de token Firebase:", error);
    }

    const body = await request.json().catch(() => ({}));
    const firebaseEmail = decodedToken?.email || body.email;
    const firebaseUid = decodedToken?.uid || body.uid;

    if (!firebaseEmail) {
      return NextResponse.json({ error: "E-mail não fornecido pelo Firebase" }, { status: 400 });
    }

    const cleanEmail = String(firebaseEmail).toLowerCase().trim();

    // 1. Busca todos os usuários do Supabase
    const { data: users, error } = await supabaseAdmin
      .from("usuarios")
      .select("*");

    if (error) {
      console.error("Erro ao consultar Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Tenta encontrar pelo e-mail (insensível a maiúsculas/minúsculas)
    let matchedUser = (users || []).find((u: any) => {
      if (!u.email) return false;
      return String(u.email).toLowerCase().trim() === cleanEmail;
    });

    // 3. Se ainda não achou, tenta pelo UID do Firebase
    if (!matchedUser && firebaseUid) {
      matchedUser = (users || []).find((u: any) => u.uid === firebaseUid || u.id === firebaseUid);
    }

    // 4. AUTO-HEALING (Auto-cura): Se o usuário existe no Firebase mas não está na tabela usuarios, cria um perfil padrão para ele não quebrar
    if (!matchedUser) {
      console.warn(`[AUTO-HEALING] Usuário autenticado no Firebase (${cleanEmail}) não estava no Supabase. Criando perfil...`);
      
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

      const { data: insertedUser, error: insertError } = await supabaseAdmin
        .from("usuarios")
        .upsert(defaultProfile, { onConflict: "id" })
        .select()
        .single();

      if (!insertError && insertedUser) {
        matchedUser = insertedUser;
      }
    }

    if (!matchedUser) {
      return NextResponse.json({ error: `Falha crítica ao sincronizar perfil para: ${cleanEmail}` }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: matchedUser });
  } catch (err: any) {
    console.error("Erro crítico na API de sync:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
