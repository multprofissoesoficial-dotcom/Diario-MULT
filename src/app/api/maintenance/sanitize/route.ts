import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

    const { action } = await req.json();

    if (action === "sanitize") {
      return await handleSanitize();
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Maintenance Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleSanitize() {
  const report = {
    analyzed: 0,
    duplicatesRemoved: 0,
    normalized: 0,
    errors: [] as string[]
  };

  try {
    const studentsSnap = await adminDb.collection("users").where("role", "==", "aluno").get();
    report.analyzed = studentsSnap.size;

    const groups: Record<string, any[]> = {};

    // 1. Group by franquiaId and codigo
    studentsSnap.forEach(doc => {
      const data = doc.data();
      const franquiaId = String(data.franquiaId || "pendente_revisao");
      const codigo = String(data.codigo || "sem_codigo");
      const key = `${franquiaId}_${codigo}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push({ id: doc.id, ...data });
    });

    // 2. Process each group with Fusion Logic
    for (const key in groups) {
      const group = groups[key];
      const [franquiaId, codigo] = key.split('_');

      try {
        const expectedId = key;
        
        // Check if the expectedId document already exists in Firestore
        const naturalDoc = await adminDb.collection("users").doc(expectedId).get();
        
        // Identify legacy records in the current group (those with random UIDs)
        let legacyRecords = group.filter(r => r.id !== expectedId);

        // FUSION LOGIC
        if (!naturalDoc.exists) {
          // No natural record exists yet. 
          if (legacyRecords.length === 0) continue;

          // Pick the best legacy record to BECOME the natural one (Survivor)
          const legacyWithMissions = await Promise.all(legacyRecords.map(async (student) => {
            const missionsSnap = await adminDb.collection("missions")
              .where("studentId", "==", student.id)
              .count()
              .get();
            return { ...student, missionCount: missionsSnap.data().count };
          }));

          legacyWithMissions.sort((a, b) => {
            if (b.missionCount !== a.missionCount) return b.missionCount - a.missionCount;
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateA - dateB;
          });

          const bestLegacy = legacyWithMissions[0];
          
          // Move bestLegacy to expectedId (Atomic Move)
          await moveUserRecord(bestLegacy.id, expectedId, bestLegacy);
          report.normalized++;
          
          // The rest of the legacy records will be merged into this new expectedId
          legacyRecords = legacyWithMissions.slice(1);
        }

        // Merge remaining legacy records into the survivor (expectedId)
        for (const legacy of legacyRecords) {
          await mergeUserRecord(legacy.id, expectedId);
          report.duplicatesRemoved++;
        }

      } catch (err: any) {
        console.error(`Error processing group ${key}:`, err);
        report.errors.push(`Erro no código ${codigo} (${franquiaId}): ${err.message}`);
      }
    }

    return NextResponse.json({ 
      message: "Saneamento concluído com sucesso",
      report 
    });
  } catch (error: any) {
    console.error("Critical Maintenance Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Moves a user record from an old ID to a new ID, including all associated data.
 */
async function moveUserRecord(oldId: string, newId: string, data: any) {
  const oldRef = adminDb.collection("users").doc(oldId);
  const newRef = adminDb.collection("users").doc(newId);

  // Prepare data for the new document
  const { id, missionCount, ...dataToCopy } = data;
  dataToCopy.legacyUid = oldId;
  dataToCopy.franquiaId = String(dataToCopy.franquiaId);
  dataToCopy.codigo = String(dataToCopy.codigo);

  // 1. Transfer associated data first (missions, enrollments, etc.)
  await transferAssociatedData(oldId, newId);

  // 2. Create the new user document and delete the old one atomically
  await adminDb.runTransaction(async (transaction) => {
    transaction.set(newRef, dataToCopy);
    transaction.delete(oldRef);
  });
}

/**
 * Merges a legacy user record into an existing target record.
 */
async function mergeUserRecord(oldId: string, newId: string) {
  const oldRef = adminDb.collection("users").doc(oldId);
  
  // 1. Transfer associated data to the existing target
  await transferAssociatedData(oldId, newId);
  
  // 2. Delete the old record
  await oldRef.delete();
}

/**
 * Transfers missions, applications, and enrollments from one studentId to another.
 */
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

  // 3. Enrollments (Sub-collection)
  const enrollmentsSnap = await adminDb.collection("users").doc(oldId).collection("enrollments").get();
  if (!enrollmentsSnap.empty) {
    // Fetch target enrollments to avoid duplicates
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
