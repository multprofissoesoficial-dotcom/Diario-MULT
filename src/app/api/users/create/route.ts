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
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const callerUid = decodedToken.uid;
    console.log(`Caller UID: ${callerUid}`);
    let callerDoc;
    try {
      callerDoc = await adminDb.collection("users").doc(callerUid).get();
    } catch (err) {
      console.error("Error fetching caller doc:", err);
      return NextResponse.json({ error: "Não autorizado (erro ao buscar perfil)" }, { status: 403 });
    }
 
    if (!callerDoc.exists) {
      console.warn(`Caller doc not found for UID: ${callerUid}`);
      return NextResponse.json({ error: "Não autorizado (perfil não encontrado)" }, { status: 403 });
    }
 
    const callerData = callerDoc.data();
    console.log(`Caller Role: ${callerData?.role}`);
    if (!callerData || !["master", "coordenador", "professor"].includes(callerData.role)) {
      return NextResponse.json({ error: "Não autorizado (permissão insuficiente)" }, { status: 403 });
    }

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
      // Check if user already exists in Auth
      userRecord = await adminAuth.getUserByEmail(finalEmail);
    } catch (error: any) {
      // If user not found, create it
      if (error.code === "auth/user-not-found" || error.message?.includes("NOT_FOUND")) {
        try {
          userRecord = await adminAuth.createUser({
            email: finalEmail,
            password: senha,
            displayName: nome,
          });
        } catch (createErr: any) {
          console.error("Error creating user:", createErr);
          return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
        }
      } else {
        // Log and return error for other auth issues
        console.error("Auth error:", error);
        return NextResponse.json({ error: "Erro na verificação de autenticação." }, { status: 500 });
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

    // Rule 1: Use .set with merge: true
    await adminDb.collection("users").doc(userRecord.uid).set(userData, { merge: true });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
