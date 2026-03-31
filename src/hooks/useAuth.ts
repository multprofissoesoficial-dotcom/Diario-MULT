import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, getDocs, setDoc, query, where, limit, getDoc } from "firebase/firestore";
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
        // ABSOLUTE STANDARD: Always search by 'uid' field. 
        // Never use doc(db, "users", user.uid) directly to avoid duplicate document logic.
        const q = query(collection(db, "users"), where("uid", "==", user.uid), limit(1));
        const querySnap = await getDocs(q);
        
        if (!querySnap.empty) {
          const snap = querySnap.docs[0];
          const data = snap.data() as UserProfile;
          const docId = snap.id;

          // Set up real-time listener on the FOUND document
          unsubProfile = onSnapshot(doc(db, "users", docId), (s) => {
            if (s.exists()) {
              const profileData = { ...s.data() as UserProfile, id: s.id };
              setProfile(profileData);
              
              // Set cookies for middleware
              document.cookie = `user_uid=${user.uid}; path=/; max-age=86400; SameSite=None; Secure`;
              document.cookie = `user_role=${profileData.role}; path=/; max-age=86400; SameSite=None; Secure`;

              // Update lastLogin if not updated recently
              const now = new Date().getTime();
              const lastLoginTime = profileData.lastLogin?.seconds ? profileData.lastLogin.seconds * 1000 : 0;
              if (now - lastLoginTime > 24 * 60 * 60 * 1000) {
                updateDoc(doc(db, "users", docId), { lastLogin: serverTimestamp() }).catch(console.error);
              }
              setLoading(false);
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
          console.warn("No profile found for user UID:", user.uid);
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
  }, [user]);

  return { user, profile, loading };
}
