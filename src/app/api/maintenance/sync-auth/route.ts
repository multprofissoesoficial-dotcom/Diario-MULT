import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: "Firebase Admin não configurado" }, { status: 503 });
  }

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const callerDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    
    if (!callerDoc.exists || callerDoc.data()?.role !== "master") {
      return NextResponse.json({ error: "Apenas Master pode realizar esta ação" }, { status: 403 });
    }

    const studentsSnap = await adminDb.collection("users").where("role", "==", "aluno").get();
    const report = {
      total: studentsSnap.size,
      updated: 0,
      errors: 0,
      details: [] as string[]
    };

    for (const doc of studentsSnap.docs) {
      const data = doc.data();
      const { franquiaId, codigo, uid, email: currentEmail } = data;

      if (franquiaId && codigo && uid) {
        const expectedEmail = `${franquiaId.trim()}_${codigo.trim()}@mult.com.br`.toLowerCase().replace(/\s+/g, "");
        
        if (currentEmail !== expectedEmail) {
          try {
            // Update Auth
            await adminAuth.updateUser(uid, { email: expectedEmail });
            // Update Firestore
            await doc.ref.update({ email: expectedEmail });
            report.updated++;
          } catch (err: any) {
            console.error(`Erro ao atualizar aluno ${uid}:`, err.message);
            report.errors++;
            report.details.push(`Erro em ${data.displayName}: ${err.message}`);
          }
        }
      }
    }

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error("Erro na manutenção:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
