import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, getDocs, setDoc, query, where, limit } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
        const docSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", user.uid), limit(1)));
        
        let finalDocId = "";
        
        if (!docSnap.empty) {
          finalDocId = user.uid;
        } else {
          // Step 2: Try composite ID from claims if available
          const tokenResult = await user.getIdTokenResult();
          const { franquiaId, codigo } = tokenResult.claims;
          
          if (franquiaId && codigo) {
            const compositeId = `${franquiaId}_${codigo}`.toLowerCase().replace(/\s+/g, "");
            const compositeSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", compositeId), limit(1)));
            if (!compositeSnap.empty) {
              finalDocId = compositeId;
            }
          }
          
          // Step 3: Fallback Query (Search for document with legacyUid == user.uid)
          // This is critical for old students already migrated to composite ID
          if (!finalDocId) {
            const q = query(collection(db, "users"), where("legacyUid", "==", user.uid), limit(1));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              finalDocId = querySnap.docs[0].id;
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
      // Legacy Migration Logic (Enrollments)
      if (data.role === "aluno" && !data.currentCourseId) {
        console.log("Migrating legacy student profile...");
        const enrollmentsRef = collection(db, "users", docId, "enrollments");
        const enrollmentsSnap = await getDocs(enrollmentsRef);
        
        if (enrollmentsSnap.empty) {
          const courseId = "INF";
          const courseName = "Informática Profissional";
          
          await setDoc(doc(db, "users", docId, "enrollments", courseId), {
            courseId,
            courseName,
            currentLesson: data.currentLesson || 1,
            status: "ativo",
            enrolledAt: data.createdAt || new Date().toISOString(),
            unlockedBadges: data.unlockedBadges || []
          });

          await updateDoc(doc(db, "users", docId), {
            currentCourseId: courseId,
            currentLesson: data.currentLesson || 1
          });
        }
      }

      setProfile(data);
      // Set cookies for middleware
      document.cookie = `user_uid=${user.uid}; path=/; max-age=86400; SameSite=None; Secure`;
      document.cookie = `user_role=${data.role}; path=/; max-age=86400; SameSite=None; Secure`;

      // Update lastLogin if not updated recently
      const now = new Date().getTime();
      const lastLoginTime = data.lastLogin?.seconds ? data.lastLogin.seconds * 1000 : 0;
      if (now - lastLoginTime > 24 * 60 * 60 * 1000) {
        updateDoc(doc(db, "users", docId), { lastLogin: serverTimestamp() }).catch(console.error);
      }
      setLoading(false);
    }
  }, [user]);

  return { user, profile, loading };
}
