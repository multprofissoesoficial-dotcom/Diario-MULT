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
    
    // Fetch caller profile to check role
    // We need to find the document by UID. 
    // Since we standardized, we search by 'uid' field.
    const callerSnap = await adminDb.collection("users").where("uid", "==", callerUid).limit(1).get();
    
    if (callerSnap.empty) {
      return NextResponse.json({ error: "Não autorizado (perfil não encontrado)" }, { status: 403 });
    }

    const callerData = callerSnap.docs[0].data();
    
    // Only Master can reset passwords globally as per request
    if (callerData.role !== "master") {
      return NextResponse.json({ error: "Não autorizado (apenas Master pode redefinir senhas)" }, { status: 403 });
    }

    const body = await request.json();
    const { uid, newPassword } = body;

    if (!uid || !newPassword) {
      return NextResponse.json({ error: "UID e nova senha são obrigatórios." }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    // Reset password in Firebase Auth
    await adminAuth.updateUser(uid, {
      password: newPassword,
    });

    console.log(`Password reset successfully for UID: ${uid} by Master: ${callerUid}`);

    return NextResponse.json({ success: true, message: "Senha redefinida com sucesso." });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    return NextResponse.json({ error: error.message || "Erro interno ao redefinir senha." }, { status: 500 });
  }
}
