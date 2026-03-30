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

    const docRef = doc(db, "users", user.uid);
    
    // First try direct UID match
    const unsubProfile = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        handleProfileData(data, user.uid);
      } else {
        // Fallback: Search for document with legacyUid == user.uid
        const q = query(collection(db, "users"), where("legacyUid", "==", user.uid), limit(1));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const data = querySnap.docs[0].data() as UserProfile;
          handleProfileData(data, querySnap.docs[0].id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    }, (error) => {
      console.error("Error listening to profile:", error);
      setLoading(false);
    });

    async function handleProfileData(data: UserProfile, docId: string) {
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

    return () => unsubProfile();
  }, [user]);

  return { user, profile, loading };
}
