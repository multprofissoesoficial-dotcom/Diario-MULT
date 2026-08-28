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
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const emailToCheck = decodedToken?.email || (await request.json()).email;
    if (!emailToCheck) {
      return NextResponse.json({ error: "E-mail não fornecido" }, { status: 400 });
    }

    // Busca o usuário no Supabase usando o Admin Client (ignora RLS e busca insensível a maiúsculas)
    const { data: users, error } = await supabaseAdmin
      .from("usuarios")
      .select("*");

    if (error) {
      console.error("Erro ao buscar usuários no Supabase Admin:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const matchedUser = (users || []).find(
      (u: any) => u.email && u.email.toLowerCase().trim() === emailToCheck.toLowerCase().trim()
    );

    if (!matchedUser) {
      return NextResponse.json({ error: "Perfil não encontrado no banco de dados." }, { status: 404 });
    }

    return NextResponse.json({ profile: matchedUser });
  } catch (err: any) {
    console.error("Erro na API de sync:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
