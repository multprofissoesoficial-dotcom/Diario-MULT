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
      console.warn("Aviso de verificação de token Admin:", error);
    }

    const { nome, email, codigo, senha, role, franquiaId, turma } = await request.json();

    if (!nome || !senha || !role) {
      return NextResponse.json({ error: "Nome, senha e cargo são obrigatórios." }, { status: 400 });
    }

    if (role !== "master" && !franquiaId) {
      return NextResponse.json({ error: "Unidade é obrigatória para este cargo." }, { status: 400 });
    }

    const cleanFranquia = franquiaId ? franquiaId.trim().toLowerCase() : "global";
    const cleanCodigo = codigo ? String(codigo).trim() : "";
    
    // Define o e-mail padrão ou usa o fornecido
    let finalEmail = email ? email.trim().toLowerCase() : "";
    if (!finalEmail && cleanCodigo) {
      finalEmail = `${cleanFranquia}_${cleanCodigo}@mult.com.br`.toLowerCase().replace(/\s+/g, "");
    } else if (!finalEmail) {
      finalEmail = `${nome.toLowerCase().replace(/[^a-z0-9]/g, "")}@mult.com.br`;
    }

    const userId = cleanCodigo && cleanFranquia !== "global" 
      ? `${cleanFranquia}_${cleanCodigo}`.toLowerCase().replace(/\s+/g, "")
      : `user_${Date.now()}`;

    const tempPassword = String(senha).trim();

    // Cria ou atualiza no Firebase Auth se disponível
    let firebaseUid = userId;
    if (adminAuth) {
      try {
        const userRecord = await adminAuth.getUserByEmail(finalEmail);
        firebaseUid = userRecord.uid;
        await adminAuth.updateUser(firebaseUid, { password: tempPassword, displayName: nome });
      } catch (authErr: any) {
        if (authErr.code === "auth/user-not-found" || authErr.message?.includes("NOT_FOUND")) {
          const newUserRecord = await adminAuth.createUser({
            email: finalEmail,
            password: tempPassword,
            displayName: nome,
          });
          firebaseUid = newUserRecord.uid;
        }
      }
    }

    // Salva ou atualiza na tabela 'usuarios' do Supabase
    const { error: userError } = await supabaseAdmin
      .from("usuarios")
      .upsert({
        id: userId,
        uid: firebaseUid,
        display_name: nome,
        email: finalEmail,
        codigo: cleanCodigo,
        role: role,
        franquia_id: cleanFranquia,
        turma: turma || (role === "aluno" ? "024inf" : null),
        xp: 0,
        unlocked_badges: [],
        created_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (userError) {
      console.error("Erro ao salvar usuário no Supabase:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Se for aluno, garante o registro inicial na tabela de matriculas
    if (role === "aluno") {
      await supabaseAdmin
        .from("matriculas")
        .upsert({
          aluno_id: userId,
          course_id: "INF",
          course_name: "Informática",
          current_lesson: 1,
          status: "ativo",
          enrolled_at: new Date().toISOString(),
          unlocked_badges: []
        }, { onConflict: "aluno_id, course_id" });
    }

    return NextResponse.json({ success: true, message: "Usuário cadastrado com sucesso!" });
  } catch (error: any) {
    console.error("Erro geral na API de criação de usuário:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
