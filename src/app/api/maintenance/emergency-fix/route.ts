import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { action, secret } = await req.json();

    // Basic security check - in a real app this would be more robust
    if (secret !== "EMERGENCY_RESET_2026") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 500 });
    }

    if (action === "verify-master") {
      const masterUid = "QLGOJUmORmR7YwIxALInWCuv5Qp1";
      const masterEmail = "faustodv@gmail.com";

      console.log(`Forcing master role for UID: ${masterUid}`);

      // 1. Update Firestore document
      // We try to find the document. It might be under the UID or under a legacy ID.
      // The request says "Verifique se o documento ... existe", implying the UID.
      const userRef = adminDb.collection("users").doc(masterUid);
      const userDoc = await userRef.get();

      const masterData = {
        uid: masterUid,
        email: masterEmail,
        role: "master",
        displayName: "Master Admin",
        updatedAt: new Date().toISOString()
      };

      if (userDoc.exists) {
        await userRef.update({ role: "master" });
      } else {
        await userRef.set(masterData);
      }

      // 2. Set Custom Claims
      await adminAuth.setCustomUserClaims(masterUid, {
        role: "master",
        master: true
      });

      return NextResponse.json({ 
        success: true, 
        message: `User ${masterUid} forced to master role and claims updated.` 
      });
    }

    if (action === "reset-users-collection") {
      console.log("Starting users collection reset...");
      
      const usersCol = adminDb.collection("users");
      const backupCol = adminDb.collection("users_backup");
      const snapshot = await usersCol.get();
      
      const masters: any[] = [];
      const totalDocs = snapshot.size;
      let backedUpCount = 0;

      // 1. Backup all users
      const batchSize = 400;
      let batch = adminDb.batch();
      let count = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.role === "master") {
          masters.push({ id: doc.id, data });
        }
        
        batch.set(backupCol.doc(doc.id), data);
        count++;
        backedUpCount++;

        if (count >= batchSize) {
          await batch.commit();
          batch = adminDb.batch();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();

      console.log(`Backup completed: ${backedUpCount} documents copied to users_backup.`);

      // 2. Delete all from users
      batch = adminDb.batch();
      count = 0;
      let deletedCount = 0;
      for (const doc of snapshot.docs) {
        batch.delete(usersCol.doc(doc.id));
        count++;
        deletedCount++;
        if (count >= batchSize) {
          await batch.commit();
          batch = adminDb.batch();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();

      console.log(`Purge completed: ${deletedCount} documents deleted from users.`);

      // 3. Restore only masters
      batch = adminDb.batch();
      count = 0;
      for (const master of masters) {
        batch.set(usersCol.doc(master.id), master.data);
        count++;
        if (count >= batchSize) {
          await batch.commit();
          batch = adminDb.batch();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();

      return NextResponse.json({ 
        success: true, 
        message: `Collection reset successful. ${backedUpCount} backed up, ${deletedCount} deleted, ${masters.length} masters restored.` 
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Emergency fix error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
