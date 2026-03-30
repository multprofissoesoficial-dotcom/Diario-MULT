import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    // 1. Security Check: Only Master
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (userData?.role !== "master" && decodedToken.email !== "multprofissoesoficial@gmail.com") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return await handleCleanupLegacy();
  } catch (error: any) {
    console.error("Cleanup Legacy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleCleanupLegacy() {
  const report = {
    analyzed: 0,
    loginsRecuperados: 0, // Migrated to official ID
    duplicadosDeletados: 0, // Deleted because official already exists
    errors: [] as string[]
  };

  try {
    const studentsSnap = await adminDb.collection("users").where("role", "==", "aluno").get();
    report.analyzed = studentsSnap.size;

    const deleteBatch = adminDb.batch();
    let deleteCount = 0;

    for (const doc of studentsSnap.docs) {
      const data = doc.data();
      const currentId = doc.id;
      const franquiaId = String(data.franquiaId || "");
      const codigo = String(data.codigo || "");

      // Forced Claims Injection for ALL analyzed students
      if (franquiaId && codigo && franquiaId !== "pendente_revisao" && codigo !== "sem_codigo") {
        try {
          await adminAuth.setCustomUserClaims(currentId, {
            role: "aluno",
            franquiaId: franquiaId,
            codigo: codigo
          });
        } catch (e: any) {
          console.error(`Failed to set claims for ${currentId}:`, e);
          report.errors.push(`Erro ao processar [${currentId}]: Falha ao injetar claims - ${e.message}`);
        }
      } else {
        report.errors.push(`Erro ao processar [${currentId}]: Falta franquiaId ou codigo para injeção de claims`);
      }

      if (!franquiaId || !codigo || franquiaId === "pendente_revisao" || codigo === "sem_codigo") {
        continue;
      }

      const expectedId = `${franquiaId}_${codigo}`;

      // If currentId is already the expectedId, skip further processing but claims were set
      if (currentId === expectedId) continue;

      try {
        const officialRef = adminDb.collection("users").doc(expectedId);
        const officialSnap = await officialRef.get();

        if (officialSnap.exists) {
          // SE EXISTIR: Comparar progresso e fundir
          const officialData = officialSnap.data();
          
          // Count missions for both
          const legacyMissionsSnap = await adminDb.collection("missions").where("studentId", "==", currentId).count().get();
          const officialMissionsSnap = await adminDb.collection("missions").where("studentId", "==", expectedId).count().get();
          
          const legacyCount = legacyMissionsSnap.data().count;
          const officialCount = officialMissionsSnap.data().count;

          if (legacyCount > officialCount) {
            // Aleatório tem mais progresso, fundir no oficial
            await mergeUserRecord(currentId, expectedId);
          } else {
            // Oficial está mais completo ou igual, apenas deletar aleatório
            // Mas garantir que o legacyUid esteja no oficial para o login funcionar
            if (!officialData?.legacyUid) {
              await officialRef.update({ legacyUid: currentId });
            }
            await adminDb.collection("users").doc(currentId).delete();
          }

          report.duplicadosDeletados++;
        } else {
          // SE NÃO EXISTIR: Renomear (Mover) - Reparador Forçado
          await moveUserRecord(currentId, expectedId, data);
          report.loginsRecuperados++;
        }
      } catch (err: any) {
        console.error(`Error cleaning up legacy record ${currentId}:`, err);
        report.errors.push(`Erro ao processar [${currentId}]: ${err.message}`);
      }
    }

    return NextResponse.json({ 
      message: "Limpeza de rastros legados concluída",
      report 
    });
  } catch (error: any) {
    console.error("Critical Cleanup Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function moveUserRecord(oldId: string, newId: string, data: any) {
  const oldRef = adminDb.collection("users").doc(oldId);
  const newRef = adminDb.collection("users").doc(newId);

  const { id, ...dataToCopy } = data;
  // Ensure security fields
  dataToCopy.legacyUid = oldId; 
  dataToCopy.uid = newId; // Update internal uid field to match doc id
  dataToCopy.franquiaId = String(dataToCopy.franquiaId);
  dataToCopy.codigo = String(dataToCopy.codigo);

  await transferAssociatedData(oldId, newId);

  await adminDb.runTransaction(async (transaction) => {
    transaction.set(newRef, dataToCopy);
    transaction.delete(oldRef);
  });
}

async function mergeUserRecord(oldId: string, newId: string) {
  const oldRef = adminDb.collection("users").doc(oldId);
  await transferAssociatedData(oldId, newId);
  await oldRef.delete();
}

async function transferAssociatedData(oldId: string, newId: string) {
  const batchSize = 450;
  
  // 1. Missions
  const missionsSnap = await adminDb.collection("missions").where("studentId", "==", oldId).get();
  if (!missionsSnap.empty) {
    let batch = adminDb.batch();
    let count = 0;
    for (const doc of missionsSnap.docs) {
      batch.update(doc.ref, { studentId: newId });
      count++;
      if (count >= batchSize) {
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  }

  // 2. Applications
  const appsSnap = await adminDb.collection("applications").where("studentId", "==", oldId).get();
  if (!appsSnap.empty) {
    let batch = adminDb.batch();
    let count = 0;
    for (const doc of appsSnap.docs) {
      batch.update(doc.ref, { studentId: newId });
      count++;
      if (count >= batchSize) {
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  }

  // 3. Enrollments
  const enrollmentsSnap = await adminDb.collection("users").doc(oldId).collection("enrollments").get();
  if (!enrollmentsSnap.empty) {
    const targetEnrollmentsSnap = await adminDb.collection("users").doc(newId).collection("enrollments").get();
    const targetEnrollmentIds = new Set(targetEnrollmentsSnap.docs.map(d => d.id));

    let batch = adminDb.batch();
    let count = 0;
    for (const doc of enrollmentsSnap.docs) {
      if (!targetEnrollmentIds.has(doc.id)) {
        batch.set(adminDb.collection("users").doc(newId).collection("enrollments").doc(doc.id), doc.data());
        count++;
      }
      batch.delete(doc.ref);
      count++;
      
      if (count >= batchSize) {
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  }
}
