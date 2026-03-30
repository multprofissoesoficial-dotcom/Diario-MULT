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

  // 1. Fetch all students
  const studentsSnap = await adminDb.collection("users").where("role", "==", "aluno").get();
  report.analyzed = studentsSnap.size;

  const groups: Record<string, any[]> = {};

  // 2. Group by franquiaId and codigo
  studentsSnap.forEach(doc => {
    const data = doc.data();
    const franquiaId = String(data.franquiaId || "pendente_revisao");
    const codigo = String(data.codigo || "sem_codigo");
    const key = `${franquiaId}_${codigo}`;

    if (!groups[key]) groups[key] = [];
    groups[key].push({ id: doc.id, ...data });
  });

  let batch = adminDb.batch();
  let batchCount = 0;

  for (const key in groups) {
    const group = groups[key];
    
    // Survivor Logic
    let survivor: any = null;

    if (group.length > 1) {
      // Need to count missions for each
      const groupWithMissions = await Promise.all(group.map(async (student) => {
        const missionsSnap = await adminDb.collection("missions")
          .where("studentId", "==", student.id)
          .count()
          .get();
        return { ...student, missionCount: missionsSnap.data().count };
      }));

      // Sort by missionCount (desc), then createdAt (asc)
      groupWithMissions.sort((a, b) => {
        if (b.missionCount !== a.missionCount) return b.missionCount - a.missionCount;
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      });

      survivor = groupWithMissions[0];
      const duplicates = groupWithMissions.slice(1);

      for (const dup of duplicates) {
        batch.delete(adminDb.collection("users").doc(dup.id));
        report.duplicatesRemoved++;
        batchCount++;
      }
    } else {
      survivor = group[0];
    }

    // Normalization Logic: Ensure document ID is composite
    const expectedId = `${survivor.franquiaId}_${survivor.codigo}`;
    if (survivor.id !== expectedId && survivor.franquiaId !== "pendente_revisao" && survivor.codigo !== "sem_codigo") {
      // Migrate document
      const oldRef = adminDb.collection("users").doc(survivor.id);
      const newRef = adminDb.collection("users").doc(expectedId);

      // Copy data
      const { id, ...dataToCopy } = survivor;
      // Add legacyUid to keep link to Auth if needed
      dataToCopy.legacyUid = survivor.id;
      dataToCopy.franquiaId = String(dataToCopy.franquiaId);
      dataToCopy.codigo = String(dataToCopy.codigo);

      batch.set(newRef, dataToCopy);
      batch.delete(oldRef);
      
      // Update missions studentId
      const missionsToUpdate = await adminDb.collection("missions")
        .where("studentId", "==", survivor.id)
        .get();
      
      for (const mDoc of missionsToUpdate.docs) {
        batch.update(mDoc.ref, { studentId: expectedId });
        batchCount++;
        if (batchCount >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }

      // Update applications studentId
      const appsToUpdate = await adminDb.collection("applications")
        .where("studentId", "==", survivor.id)
        .get();
      
      for (const aDoc of appsToUpdate.docs) {
        batch.update(aDoc.ref, { studentId: expectedId });
        batchCount++;
        if (batchCount >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }

      // Move enrollments sub-collection
      const enrollmentsSnap = await oldRef.collection("enrollments").get();
      for (const eDoc of enrollmentsSnap.docs) {
        batch.set(newRef.collection("enrollments").doc(eDoc.id), eDoc.data());
        batch.delete(eDoc.ref);
        batchCount += 2;
        if (batchCount >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }

      report.normalized++;
      // No need to add to batchCount here, it's already handled in loops
    } else {
      // Just ensure fields are strings
      batch.update(adminDb.collection("users").doc(survivor.id), {
        franquiaId: String(survivor.franquiaId || "pendente_revisao"),
        codigo: String(survivor.codigo || "sem_codigo")
      });
      batchCount++;
    }

    // Commit batch if it gets too large
    if (batchCount >= 450) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  // Final commit
  if (batchCount > 0) {
    await batch.commit();
  }

  return NextResponse.json({ 
    message: "Saneamento concluído com sucesso",
    report 
  });
}
