import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth!.verifyIdToken(token);
    
    // Only master can sync counters
    if (decodedToken.role !== "master" && decodedToken.email !== "faustodv@gmail.com") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Firebase Admin não configurado" }, { status: 500 });
    }

    console.log("Starting global counters synchronization...");

    // 1. Get counts for each role
    const roles = ["aluno", "professor", "coordenador", "rh", "master"];
    const counts: Record<string, number> = {};
    let total = 0;

    for (const role of roles) {
      const snapshot = await adminDb.collection("users").where("role", "==", role).count().get();
      const count = snapshot.data().count;
      counts[`${role}Count`] = count;
      total += count;
    }

    // 2. Get mission counts
    const missionsSnapshot = await adminDb.collection("missions").count().get();
    const totalMissions = missionsSnapshot.data().count;

    const pendingMissionsSnapshot = await adminDb.collection("missions").where("status", "==", "pending").count().get();
    const pendingMissions = pendingMissionsSnapshot.data().count;

    // 3. Get ATS counts
    const jobsSnapshot = await adminDb.collection("job_postings").where("status", "==", "aberta").count().get();
    const activeJobs = jobsSnapshot.data().count;

    const applicationsSnapshot = await adminDb.collection("applications").count().get();
    const totalApplications = applicationsSnapshot.data().count;

    const companiesSnapshot = await adminDb.collection("companies").count().get();
    const totalCompanies = companiesSnapshot.data().count;

    // 4. Update metadata document
    const statsData = {
      users: {
        total,
        aluno: counts.alunoCount,
        professor: counts.professorCount,
        coordenador: counts.coordenadorCount,
        rh: counts.rhCount,
        master: counts.masterCount
      },
      missions: {
        total: totalMissions,
        pending: pendingMissions
      },
      ats: {
        jobs: activeJobs,
        applications: totalApplications,
        companies: totalCompanies
      },
      lastSync: new Date().toISOString()
    };

    await adminDb.collection("metadata").doc("global_stats").set(statsData, { merge: true });

    return NextResponse.json({ 
      success: true, 
      message: "Contadores sincronizados com sucesso.",
      data: statsData
    });

  } catch (error: any) {
    console.error("Sync counters error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
