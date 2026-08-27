import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (userData?.role !== "master" && decodedToken.email !== "multprofissoesoficial@gmail.com" && decodedToken.email !== "faustodv@gmail.com") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const colecoes = [
      "users",
      "missions",
      "job_postings",
      "companies",
      "applications",
      "franquias",
      "courses"
    ];

    const backupCompleto: Record<string, any[]> = {};

    for (const col of colecoes) {
      try {
        const snap = await adminDb.collection(col).get();
        backupCompleto[col] = snap.docs.map((d) => ({
          _id: d.id,
          ...d.data(),
        }));
      } catch (err: any) {
        console.warn(`Erro ao exportar coleção ${col}:`, err.message);
        backupCompleto[col] = [];
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: backupCompleto
    });
  } catch (error: any) {
    console.error("Erro no endpoint de backup:", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
