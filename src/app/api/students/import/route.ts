import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminAuth } from "@/lib/firebase-admin";

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Configuração do Supabase ausente no servidor." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { students, courseId, courseName } = await request.json();

    if (!Array.isArray(students) || !courseId || !courseName) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const results = {
      success: 0,
      skipped: 0,
      errors: 0,
    };

    for (const student of students) {
      try {
        const { nome, codigo, senha, franquiaId, turma } = student;

        if (!nome || (!codigo) || !franquiaId) {
          results.errors++;
          continue;
        }

        const cleanFranquia = franquiaId.trim().toLowerCase();
        const cleanCodigo = String(codigo).trim();
        const finalEmail = `${cleanFranquia}_${cleanCodigo}@mult.com.br`.toLowerCase().replace(/\s+/g, "");
        const studentId = `${cleanFranquia}_${cleanCodigo}`.toLowerCase().replace(/\s+/g, "");
        const tempPassword = senha ? String(senha).trim() : cleanCodigo || "nome123";

        let firebaseUid = studentId;
        if (adminAuth) {
          try {
            const userRecord = await adminAuth.getUserByEmail(finalEmail);
            firebaseUid = userRecord.uid;
            await adminAuth.updateUser(firebaseUid, { password: tempPassword });
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

        const { error: userError } = await supabaseAdmin
          .from("usuarios")
          .upsert({
            id: studentId,
            uid: firebaseUid,
            display_name: nome,
            email: finalEmail,
            codigo: cleanCodigo,
            role: "aluno",
            franquia_id: cleanFranquia,
            turma: turma || "024inf",
            xp: 0,
            current_course_id: courseId,
            unlocked_badges: [],
            created_at: new Date().toISOString()
          }, { onConflict: "id" });

        if (userError) {
          console.error("Erro ao salvar usuário no Supabase:", userError);
          results.errors++;
          continue;
        }

        const { error: matriculaError } = await supabaseAdmin
          .from("matriculas")
          .upsert({
            aluno_id: studentId,
            course_id: courseId,
            course_name: courseName,
            current_lesson: 1,
            status: "ativo",
            enrolled_at: new Date().toISOString(),
            unlocked_badges: []
          }, { onConflict: "aluno_id, course_id" });

        if (matriculaError) {
          console.error("Erro ao salvar matrícula no Supabase:", matriculaError);
        }

        results.success++;
      } catch (err) {
        console.error("Erro individual ao importar aluno:", err);
        results.errors++;
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Erro geral na API de importação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
