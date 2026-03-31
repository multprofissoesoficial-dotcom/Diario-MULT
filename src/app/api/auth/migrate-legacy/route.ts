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
    const uid = decodedToken.uid;

    // 1. Check if user is already migrated (found via legacyUid)
    // Actually, the frontend calls this if it detects a legacy state.
    // Let's find the current document for this UID.
    
    // First, try to find the document with ID == UID
    const directDoc = await adminDb.collection("users").doc(uid).get();
    
    if (!directDoc.exists) {
      // If document with ID == UID doesn't exist, maybe it's already migrated?
      // Let's check if there's a document with legacyUid == UID
      const migratedSnap = await adminDb.collection("users").where("legacyUid", "==", uid).limit(1).get();
      if (!migratedSnap.empty) {
        // Already migrated. Just ensure claims are set.
        const officialDoc = migratedSnap.docs[0];
        const data = officialDoc.data();
        if (data.franquiaId && data.codigo) {
          await adminAuth.setCustomUserClaims(uid, {
            role: "aluno",
            franquiaId: data.franquiaId,
            codigo: data.codigo
          });
        }
        return NextResponse.json({ success: true, message: "Already migrated", docId: officialDoc.id });
      }
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const data = directDoc.data();
    if (!data) return NextResponse.json({ error: "No data" }, { status: 404 });

    // 2. Determine expected ID
    const franquiaId = String(data.franquiaId || "pendente_revisao");
    const codigo = String(data.codigo || "sem_codigo");
    
    if (franquiaId === "pendente_revisao" || codigo === "sem_codigo") {
      return NextResponse.json({ error: "Incomplete data for migration" }, { status: 400 });
    }

    const expectedId = `${franquiaId}_${codigo}`.toLowerCase().replace(/\s+/g, "");

    // If already at expectedId (shouldn't happen if directDoc.id == uid and uid != expectedId)
    if (uid === expectedId) {
      // Just ensure claims
      await adminAuth.setCustomUserClaims(uid, {
        role: "aluno",
        franquiaId: data.franquiaId,
        codigo: data.codigo
      });
      return NextResponse.json({ success: true, message: "ID already matches expected", docId: uid });
    }

    // 3. Check if official document already exists
    const officialDoc = await adminDb.collection("users").doc(expectedId).get();
    
    if (officialDoc.exists) {
      // Merge logic (similar to cleanup-legacy)
      const officialData = officialDoc.data();
      
      // Transfer associated data
      await transferAssociatedData(uid, expectedId);
      
      // Update official with legacyUid and uid if missing or incorrect
      const updates: any = { legacyUid: uid };
      if (officialData?.uid !== uid) {
        updates.uid = uid; // Ensure the link to Auth UID is correct
      }
      await adminDb.collection("users").doc(expectedId).update(updates);
      
      // Delete old
      await adminDb.collection("users").doc(uid).delete();
    } else {
      // Move logic
      const dataToCopy = { ...data };
      dataToCopy.legacyUid = uid;
      dataToCopy.uid = uid; // CRITICAL: This is the Auth UID
      
      await transferAssociatedData(uid, expectedId);
      
      await adminDb.runTransaction(async (transaction) => {
        transaction.set(adminDb.collection("users").doc(expectedId), dataToCopy);
        transaction.delete(adminDb.collection("users").doc(uid));
      });
    }

    // 4. Set Custom Claims
    await adminAuth.setCustomUserClaims(uid, {
      role: "aluno",
      franquiaId: data.franquiaId,
      codigo: data.codigo
    });

    return NextResponse.json({ success: true, message: "Migration successful", docId: expectedId });

  } catch (error: any) {
    console.error("Migration API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
