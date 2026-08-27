import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);

    // Validação de segurança Master
    if (decoded.email !== "faustodv@gmail.com" && decoded.email !== "multprofissoesoficial@gmail.com") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
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
      const snap = await adminDb.collection(col).get();
      backupCompleto[col] = snap.docs.map(d => ({
        _id: d.id,
        ...d.data()
      }));
    }

    // Retorna o JSON completo para download
    return new NextResponse(JSON.stringify(backupCompleto, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=backup_mult_${new Date().toISOString().split('T')[0]}.json`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
