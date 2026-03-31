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

    const { action, studentName, dryRun = true } = await req.json();

    if (action === "diagnose") {
      return await handleDiagnose(studentName);
    }

    if (action === "relink") {
      return await handleRelink(dryRun);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Relink Maintenance Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleDiagnose(name: string) {
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const report: any = {
    usersFound: [],
    missionsFound: [],
  };

  // 1. Find users by name
  const usersSnap = await adminDb.collection("users")
    .where("displayName", ">=", name)
    .where("displayName", "<=", name + "\uf8ff")
    .get();
  
  usersSnap.forEach(doc => {
    report.usersFound.push({ id: doc.id, ...doc.data() });
  });

  // 2. Find missions by studentName
  const missionsSnap = await adminDb.collection("missions")
    .where("studentName", ">=", name)
    .where("studentName", "<=", name + "\uf8ff")
    .get();
  
  missionsSnap.forEach(doc => {
    report.missionsFound.push({ id: doc.id, ...doc.data() });
  });

  return NextResponse.json(report);
}

async function handleRelink(dryRun: boolean) {
  const report = {
    totalMissions: 0,
    orphanedMissions: 0,
    relinkedMissions: 0,
    unresolvedMissions: 0,
    details: [] as string[]
  };

  try {
    // 1. Fetch all missions
    const missionsSnap = await adminDb.collection("missions").get();
    report.totalMissions = missionsSnap.size;

    // 2. Fetch all users to build a lookup map
    const usersSnap = await adminDb.collection("users").get();
    const userMap: Record<string, any> = {};
    const uidMap: Record<string, string> = {}; // legacyUid -> currentId
    const nameMap: Record<string, string[]> = {}; // name -> [ids]

    usersSnap.forEach(doc => {
      const data = doc.data();
      userMap[doc.id] = data;
      if (data.uid) uidMap[data.uid] = doc.id;
      if (data.legacyUid) uidMap[data.legacyUid] = doc.id;
      
      const normalizedName = data.displayName.toLowerCase().trim();
      if (!nameMap[normalizedName]) nameMap[normalizedName] = [];
      nameMap[normalizedName].push(doc.id);
    });

    const batchSize = 450;
    let batch = adminDb.batch();
    let batchCount = 0;

    for (const missionDoc of missionsSnap.docs) {
      const mission = missionDoc.data();
      const currentStudentId = mission.studentId;

      // Check if studentId is valid
      if (userMap[currentStudentId]) {
        continue; // Already linked to a valid user
      }

      report.orphanedMissions++;

      // Try to find the correct ID
      let targetId = uidMap[currentStudentId];

      if (!targetId) {
        // Try by name
        const normalizedMissionName = mission.studentName.toLowerCase().trim();
        const possibleIds = nameMap[normalizedMissionName];
        
        if (possibleIds && possibleIds.length === 1) {
          targetId = possibleIds[0];
        } else if (possibleIds && possibleIds.length > 1) {
          // If multiple, try to match by franquiaId
          const matchingFranchise = possibleIds.find(id => userMap[id].franquiaId === mission.franquiaId);
          if (matchingFranchise) {
            targetId = matchingFranchise;
          }
        }
      }

      if (targetId) {
        report.relinkedMissions++;
        if (!dryRun) {
          batch.update(missionDoc.ref, { studentId: targetId });
          batchCount++;
          if (batchCount >= batchSize) {
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
        report.details.push(`Mission ${missionDoc.id} (${mission.studentName}): ${currentStudentId} -> ${targetId}`);
      } else {
        report.unresolvedMissions++;
        report.details.push(`Mission ${missionDoc.id} (${mission.studentName}): ${currentStudentId} -> UNRESOLVED`);
      }
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      message: dryRun ? "Simulação concluída" : "Re-vínculo concluído",
      report 
    });
  } catch (error: any) {
    console.error("Relink Logic Error:", error);
    throw error;
  }
}
