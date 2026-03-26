import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: "Firebase Admin não configurado neste ambiente." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const { nome, email, codigo, senha, role, franquiaId, turma } = body;

    if (!nome || !senha || !role) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    let finalEmail = email?.trim();
    if (role === "aluno" && !finalEmail && codigo) {
      finalEmail = `${codigo.trim()}@mult.com.br`;
    }

    if (!finalEmail || !finalEmail.includes("@")) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: finalEmail,
        password: senha,
        displayName: nome,
      });
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        userRecord = await adminAuth.getUserByEmail(finalEmail);
      } else {
        throw error;
      }
    }

    const userData = {
      uid: userRecord.uid,
      displayName: nome,
      email: finalEmail,
      codigo: codigo || "",
      role: role,
      franquiaId: franquiaId || "",
      turma: role === "aluno" ? (turma || "024inf") : "",
      xp: 0,
      unlockedBadges: [],
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection("users").doc(userRecord.uid).set(userData, { merge: true });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
