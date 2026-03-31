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

          let finalEmail = email?.trim();
          if (!finalEmail && codigo) {
            finalEmail = `${codigo.trim()}@mult.com.br`;
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
            // Update existing user
            await userRef.update({
              franquiaId: franquiaId,
              turma: turma || userData.turma || "024inf"
            });

            // Add/Update enrollment
            const enrollmentRef = userRef.collection("enrollments").doc(courseId);
            const enrollmentSnap = await enrollmentRef.get();

            if (!enrollmentSnap.exists) {
              await enrollmentRef.set({
                courseId,
                courseName,
                currentLesson: 1,
                status: "ativo",
                enrolledAt: new Date().toISOString(),
                unlockedBadges: []
              });
            }
            results.success++;
            return;
          }

          // Create new user
          let userRecord;
          try {
            // Try to get by compositeId if exists in Auth
            if (compositeId) {
              try {
                userRecord = await adminAuth.getUser(compositeId);
              } catch (e) {
                userRecord = await adminAuth.getUserByEmail(finalEmail);
              }
            } else {
              userRecord = await adminAuth.getUserByEmail(finalEmail);
            }
          } catch (authErr: any) {
            if (authErr.code === "auth/user-not-found" || authErr.message?.includes("NOT_FOUND")) {
              userRecord = await adminAuth.createUser({
                uid: compositeId || undefined,
                email: finalEmail,
                password: senha || String(codigo) || "nome123",
                displayName: nome,
              });
            } else {
              throw authErr;
            }
          }

          const newUserRef = adminDb.collection("users").doc(userRecord.uid);
          const studentData = {
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
            currentCourseId: courseId
          };

          await newUserRef.set(studentData);
          
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
