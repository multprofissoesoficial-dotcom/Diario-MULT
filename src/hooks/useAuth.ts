import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, getDocs, setDoc, query, where, limit, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "migrating" | "error" | "success">("idle");
  const migrationStatusRef = useRef<"idle" | "migrating" | "error" | "success">("idle");

  // Keep ref in sync with state for use in closures
  useEffect(() => {
    migrationStatusRef.current = migrationStatus;
  }, [migrationStatus]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        // Clear cookies on logout
        document.cookie = "user_uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
        document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubProfile: (() => void) | null = null;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Step 1: Try direct UID match (Standard for new users or non-migrated)
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        let finalDocId = "";
        
        if (docSnap.exists()) {
          finalDocId = user.uid;
        } else {
          // Step 2: Fallback Query (Search for document with legacyUid == user.uid)
          // This is now the priority absolute for migrated students
          const q = query(collection(db, "users"), where("legacyUid", "==", user.uid), limit(1));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty) {
            finalDocId = querySnap.docs[0].id;
          } else {
            // Step 3: Try composite ID from claims if available
            const tokenResult = await user.getIdTokenResult();
            const { franquiaId, codigo } = tokenResult.claims;
            
            if (franquiaId && codigo) {
              const compositeId = `${franquiaId}_${codigo}`.toLowerCase().replace(/\s+/g, "");
              const compositeDocRef = doc(db, "users", compositeId);
              const compositeSnap = await getDoc(compositeDocRef);
              if (compositeSnap.exists()) {
                finalDocId = compositeId;
              }
            }
          }
        }

        if (finalDocId) {
          // Set up real-time listener on the CORRECT document
          unsubProfile = onSnapshot(doc(db, "users", finalDocId), (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserProfile;
              handleProfileData(data, finalDocId);
            } else {
              setProfile(null);
              setLoading(false);
            }
          }, (err) => {
            console.error("Error in profile snapshot:", err);
            setProfile(null);
            setLoading(false);
          });
        } else {
          console.warn("No profile found for user:", user.uid);
          setProfile(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setProfile(null);
        setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      if (unsubProfile) unsubProfile();
    };

    async function handleProfileData(data: UserProfile, docId: string) {
      if (!user) return;

      // Senior Audit: Detect legacy profile (ID == UID) and trigger server-side migration
      if (data.role === "aluno" && docId === user.uid) {
        const currentStatus = migrationStatusRef.current;
        
        if (currentStatus === "idle") {
          setMigrationStatus("migrating");
          console.warn("Legacy profile detected (ID == UID). Triggering server-side migration...");
          try {
            const idToken = await user.getIdToken();
            const response = await fetch("/api/auth/migrate-legacy", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${idToken}`,
                "Content-Type": "application/json"
              }
            });

            if (response.ok) {
              const result = await response.json();
              console.log("Migration successful:", result);
              setMigrationStatus("success");
              // Force a re-fetch of the profile after migration
              fetchProfile();
              return;
            } else {
              const errorData = await response.json();
              console.error("Migration failed:", errorData.error);
              setMigrationStatus("error");
            }
          } catch (err) {
            console.error("Error during migration call:", err);
            setMigrationStatus("error");
          }
        } else if (currentStatus === "migrating") {
          // Already migrating, just wait
          return;
        } else if (currentStatus === "error") {
          // Stop retry on error to prevent console spam
          console.error("Migration is in error state. Stopping retries.");
          setProfile(data); // Still set profile so app can work if possible
          setLoading(false);
          return;
        }
        return; // Ensure we don't proceed to setProfile(data) if it's legacy and we are handling it
      }

      setProfile(data);
      // Set cookies for middleware
      document.cookie = `user_uid=${user.uid}; path=/; max-age=86400; SameSite=None; Secure`;
      document.cookie = `user_role=${data.role}; path=/; max-age=86400; SameSite=None; Secure`;

      // Update lastLogin if not updated recently AND NOT in legacy state
      if (docId !== user.uid) {
        const now = new Date().getTime();
        const lastLoginTime = data.lastLogin?.seconds ? data.lastLogin.seconds * 1000 : 0;
        if (now - lastLoginTime > 24 * 60 * 60 * 1000) {
          updateDoc(doc(db, "users", docId), { lastLogin: serverTimestamp() }).catch(console.error);
        }
      }
      setLoading(false);
    }
  }, [user]);

  return { user, profile, loading, migrationStatus };
}
