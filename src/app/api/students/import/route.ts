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
    const { students } = await request.json();

    if (!Array.isArray(students)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const results = {
      success: 0,
      skipped: 0,
      errors: 0,
    };

    // Process in batches of 50 (Firestore limit is 500, but we also do Auth calls)
    const batchSize = 50;
    for (let i = 0; i < students.length; i += batchSize) {
      const chunk = students.slice(i, i + batchSize);
      const batch = adminDb.batch();

      await Promise.all(chunk.map(async (student: any) => {
        try {
          const { nome, email, codigo, senha, franquiaId, turma } = student;

          if (!nome || (!email && !codigo) || !franquiaId) {
            results.errors++;
            return;
          }

          let finalEmail = email?.trim();
          if (!finalEmail && codigo) {
            finalEmail = `${codigo.trim()}@mult.com.br`;
          }

          // Check if user exists in Firestore
          const existingUser = await adminDb.collection("users")
            .where("email", "==", finalEmail)
            .limit(1)
            .get();

          if (!existingUser.empty) {
            results.skipped++;
            return;
          }

          if (codigo) {
            const existingCode = await adminDb.collection("users")
              .where("codigo", "==", codigo)
              .limit(1)
              .get();
            if (!existingCode.empty) {
              results.skipped++;
              return;
            }
          }

          let userRecord;
          try {
            userRecord = await adminAuth.createUser({
              email: finalEmail,
              password: senha || String(codigo) || "nome123",
              displayName: nome,
            });
          } catch (authErr: any) {
            if (authErr.code === "auth/email-already-in-use") {
              userRecord = await adminAuth.getUserByEmail(finalEmail);
            } else {
              throw authErr;
            }
          }

          const userRef = adminDb.collection("users").doc(userRecord.uid);
          batch.set(userRef, {
            uid: userRecord.uid,
            displayName: nome,
            email: finalEmail,
            codigo: codigo || "",
            role: "aluno",
            franquiaId: franquiaId,
            turma: turma || "024inf",
            xp: 0,
            unlockedBadges: [],
            createdAt: new Date().toISOString(),
          }, { merge: true });

          results.success++;
        } catch (err) {
          console.error("Error importing student:", err);
          results.errors++;
        }
      }));

      await batch.commit();
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
