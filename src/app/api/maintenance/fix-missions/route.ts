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
    const callerSnap = await adminDb.collection("users").where("uid", "==", callerUid).limit(1).get();
    
    if (callerSnap.empty) {
      return NextResponse.json({ error: "Não autorizado (perfil não encontrado)" }, { status: 403 });
    }

    const callerData = callerSnap.docs[0].data();
    
    // Only Master can run maintenance
    if (callerData.role !== "master") {
      return NextResponse.json({ error: "Não autorizado (apenas Master pode executar manutenção)" }, { status: 403 });
    }

    // Maintenance Logic: Fix missions missing franquiaId
    const missionsRef = adminDb.collection("missions");
    // We can't easily query for "missing field" in Firestore without an index or by fetching all.
    // For a small/medium dataset, we fetch all and filter in memory or fetch those where franquiaId is not set if we have a way.
    // Actually, we can just fetch all and check.
    
    const snapshot = await missionsRef.get();
    let count = 0;
    let batch = adminDb.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.franquiaId) {
        batch.update(doc.ref, { franquiaId: "rio-verde" });
        count++;
        batchCount++;

        if (batchCount === 500) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Manutenção concluída. ${count} missões atualizadas com franquiaId: 'rio-verde'.` 
    });
  } catch (error: any) {
    console.error("Error in maintenance:", error);
    return NextResponse.json({ error: error.message || "Erro interno na manutenção." }, { status: 500 });
  }
}
