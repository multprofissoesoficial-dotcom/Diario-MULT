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
    let callerDoc;
    try {
      callerDoc = await adminDb.collection("users").doc(callerUid).get();
    } catch (err) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    if (!callerDoc.exists) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const callerData = callerDoc.data();
    if (!callerData || !["master", "coordenador", "professor"].includes(callerData.role)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

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
            // Check if user already exists in Auth
            userRecord = await adminAuth.getUserByEmail(finalEmail);
          } catch (authErr: any) {
            // Rule 2: If user not found, create it
            if (authErr.code === "auth/user-not-found" || authErr.message?.includes("NOT_FOUND")) {
              try {
                userRecord = await adminAuth.createUser({
                  email: finalEmail,
                  password: senha || String(codigo) || "nome123",
                  displayName: nome,
                });
              } catch (createErr: any) {
                console.error(`Error creating user ${finalEmail}:`, createErr);
                results.errors++;
                return;
              }
            } else {
              // Log other auth errors
              console.error(`Auth error for ${finalEmail}:`, authErr);
              results.errors++;
              return;
            }
          }

          const userRef = adminDb.collection("users").doc(userRecord.uid);
          // Rule 1: Use batch.set with merge: true
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
