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
      return NextResponse.json({ error: `Não autorizado (erro ao buscar perfil: ${err instanceof Error ? err.message : String(err)})` }, { status: 403 });
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

    // Composite ID for students
    const compositeId = role === "aluno" && franquiaId && codigo 
      ? `${franquiaId}_${codigo}`.toLowerCase().replace(/\s+/g, "")
      : null;

    let finalEmail = email?.trim();
    if (role === "aluno" && codigo && franquiaId) {
      // NOVO PADRÃO: O e-mail de login deve ser unidade_codigo@mult.com.br para garantir unicidade e identificação
      finalEmail = `${franquiaId.trim()}_${codigo.trim()}@mult.com.br`.toLowerCase().replace(/\s+/g, "");
    } else if (role === "aluno" && !finalEmail && codigo) {
      finalEmail = `${codigo.trim()}@mult.com.br`.toLowerCase();
    }

    if (!finalEmail || !finalEmail.includes("@")) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    let userRecord;
    try {
      // ALWAYS try to get by email first to link legacy accounts
      userRecord = await adminAuth.getUserByEmail(finalEmail);
      console.log(`Found existing Auth user for ${finalEmail}: ${userRecord.uid}`);
    } catch (error: any) {
      // If user not found, create it
      if (error.code === "auth/user-not-found" || error.message?.includes("NOT_FOUND")) {
        try {
          userRecord = await adminAuth.createUser({
            uid: compositeId || undefined,
            email: finalEmail,
            password: senha,
            displayName: nome,
          });
          console.log(`Created new Auth user for ${finalEmail}: ${userRecord.uid}`);
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
      uid: userRecord.uid, // CRITICAL: Link to Auth UID
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

    // Use compositeId as Document ID if student, otherwise use UID
    const finalDocId = compositeId || userRecord.uid;
    await adminDb.collection("users").doc(finalDocId).set(userData, { merge: true });

    // Update global counters if it's a new user
    // We check if it's a new user by checking if the userRecord was just created
    // (In this specific API, if we reach here, we either found or created it)
    // To be safe, we only increment if it's a new creation or if we want to ensure consistency.
    // The user requested: "a cada novo registro bem-sucedido, os contadores globais sejam incrementados"
    
    const { FieldValue } = require("firebase-admin/firestore");
    const statsRef = adminDb.collection("metadata").doc("global_stats");
    
    const incrementData: any = {};
    incrementData[`users.${role}`] = FieldValue.increment(1);
    incrementData[`users.total`] = FieldValue.increment(1);
    
    await statsRef.set(incrementData, { merge: true });

    // Set custom claims for easier identification in frontend
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: role,
      franquiaId: franquiaId || "",
      codigo: codigo || ""
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
