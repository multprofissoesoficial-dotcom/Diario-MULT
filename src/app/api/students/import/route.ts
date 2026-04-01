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

    const { students, courseId, courseName } = await request.json();

    if (!Array.isArray(students) || !courseId || !courseName) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const results = {
      success: 0,
      skipped: 0,
      errors: 0,
    };

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < students.length; i += batchSize) {
      const chunk = students.slice(i, i + batchSize);
      
      await Promise.all(chunk.map(async (student: any) => {
        try {
          const { nome, email, codigo, senha, franquiaId, turma } = student;

          if (!nome || (!email && !codigo) || !franquiaId) {
            results.errors++;
            return;
          }

          let finalEmail = email?.trim().toLowerCase();
          // NOVO PADRÃO: O e-mail de login deve ser unidade_codigo@mult.com.br para garantir unicidade e identificação
          if (codigo && franquiaId) {
            finalEmail = `${franquiaId.trim()}_${codigo.trim()}@mult.com.br`.toLowerCase().replace(/\s+/g, "");
          } else if (!finalEmail && codigo) {
            finalEmail = `${codigo.trim()}@mult.com.br`.toLowerCase();
          }

          // Composite ID for students
          const compositeId = franquiaId && codigo 
            ? `${franquiaId}_${codigo}`.toLowerCase().replace(/\s+/g, "")
            : null;

          // Check if user exists in Firestore by compositeId first
          let userRef;
          let userData;

          if (compositeId) {
            const docRef = adminDb.collection("users").doc(compositeId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
              userRef = docRef;
              userData = docSnap.data();
            }
          }

          // If not found by compositeId, try searching by codigo and franquiaId
          if (!userRef && codigo && franquiaId) {
            const existingByCode = await adminDb.collection("users")
              .where("codigo", "==", codigo)
              .where("franquiaId", "==", franquiaId)
              .limit(1)
              .get();

            if (!existingByCode.empty) {
              userRef = existingByCode.docs[0].ref;
              userData = existingByCode.docs[0].data();
            }
          }

          // If still not found, try by email
          if (!userRef && finalEmail) {
            const existingByEmail = await adminDb.collection("users")
              .where("email", "==", finalEmail)
              .limit(1)
              .get();
            
            if (!existingByEmail.empty) {
              userRef = existingByEmail.docs[0].ref;
              userData = existingByEmail.docs[0].data();
            }
          }

          if (userRef && userData) {
            // Update existing user in Firestore
            await userRef.update({
              franquiaId: franquiaId,
              email: finalEmail, // Update to new standard email
              turma: turma || userData.turma || "024inf"
            });

            // Update user in Firebase Auth if UID exists
            if (userData.uid) {
              try {
                await adminAuth.updateUser(userData.uid, {
                  email: finalEmail,
                  password: senha || String(codigo) || "nome123"
                });
                console.log(`Auth updated for existing student: ${userData.uid} to ${finalEmail}`);
              } catch (authErr) {
                console.error(`Error updating Auth for student ${userData.uid}:`, authErr);
              }
            }
            results.success++;
            return;
          }

          // Create or Get user from Auth
          let userRecord;
          try {
            // ALWAYS try to get by email first to link legacy accounts
            userRecord = await adminAuth.getUserByEmail(finalEmail);
            console.log(`Found existing Auth user for ${finalEmail}: ${userRecord.uid}`);
          } catch (authErr: any) {
            if (authErr.code === "auth/user-not-found" || authErr.message?.includes("NOT_FOUND")) {
              // Create new user if not exists
              userRecord = await adminAuth.createUser({
                uid: compositeId || undefined, // Use compositeId as UID for new users if possible
                email: finalEmail,
                password: senha || String(codigo) || "nome123",
                displayName: nome,
              });
              console.log(`Created new Auth user for ${finalEmail}: ${userRecord.uid}`);
            } else {
              throw authErr;
            }
          }

          // If user was found but not created, we still want to update the password as per request
          if (userRecord && !userRef) {
             try {
                await adminAuth.updateUser(userRecord.uid, {
                  password: senha || String(codigo) || "nome123"
                });
                console.log(`Password updated for found Auth user: ${userRecord.uid}`);
              } catch (authErr) {
                console.error(`Error updating password for Auth user ${userRecord.uid}:`, authErr);
              }
          }

          // Use compositeId as the DOCUMENT ID, but store the Auth UID inside
          const newUserRef = adminDb.collection("users").doc(compositeId || userRecord.uid);
          const studentData = {
            uid: userRecord.uid, // This is the CRITICAL link to Auth
            displayName: nome,
            email: finalEmail,
            codigo: codigo || "",
            role: "aluno",
            franquiaId: franquiaId,
            turma: turma || "024inf",
            xp: 0,
            unlockedBadges: [],
            createdAt: new Date().toISOString(),
            currentCourseId: courseId
          };

          await newUserRef.set(studentData, { merge: true });
          
          // Update global counters for new student
          const { FieldValue } = require("firebase-admin/firestore");
          const statsRef = adminDb.collection("metadata").doc("global_stats");
          await statsRef.set({
            "users.aluno": FieldValue.increment(1),
            "users.total": FieldValue.increment(1)
          }, { merge: true });

          // Add initial enrollment
          await newUserRef.collection("enrollments").doc(courseId).set({
            courseId,
            courseName,
            currentLesson: 1,
            status: "ativo",
            enrolledAt: new Date().toISOString(),
            unlockedBadges: []
          });

          results.success++;
        } catch (err) {
          console.error("Error importing student:", err);
          results.errors++;
        }
      }));
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
