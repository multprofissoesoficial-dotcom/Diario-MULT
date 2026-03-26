import * as admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  try {
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
        databaseURL: `https://${projectId}.firebaseio.com`,
      });
      console.log("Firebase Admin initialized successfully.");
    } else {
      console.warn("Firebase Admin missing credentials, running in fallback mode");
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    console.warn("Firebase Admin missing credentials, running in fallback mode");
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
