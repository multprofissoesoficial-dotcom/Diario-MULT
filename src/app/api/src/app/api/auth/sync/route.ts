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
      console.warn("Aviso de verificação de token:", error);
    }

    const body = await request.json().catch(() => ({}));
    const emailToCheck = decodedToken?.email || body.email;

    if (!emailToCheck) {
      return NextResponse.json({ error: "E-mail não fornecido na requisição" }, { status: 400 });
    }

    const cleanInputEmail = String(emailToCheck).toLowerCase().trim();

    // Busca todos os usuários usando o Admin Client (ignora RLS)
    const { data: users, error } = await supabaseAdmin
      .from("usuarios")
      .select("*");

    if (error) {
      console.error("Erro ao buscar usuários no Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Procura o usuário ignorando maiúsculas, minúsculas e espaços em branco
    const matchedUser = (users || []).find((u: any) => {
      if (!u.email) return false;
      return String(u.email).toLowerCase().trim() === cleanInputEmail;
    });

    if (!matchedUser) {
      console.warn(`[SYNC] Perfil não encontrado para o e-mail: "${cleanInputEmail}"`);
      return NextResponse.json({ 
        error: `Perfil não encontrado para o e-mail: ${emailToCheck}` 
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: matchedUser });
  } catch (err: any) {
    console.error("Erro crítico na API de sync:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
