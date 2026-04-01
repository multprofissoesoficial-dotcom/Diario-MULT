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
        // 1. Try to construct compositeId from email (standard for students)
        const email = user.email?.toLowerCase() || "";
        const [prefix] = email.split('@');
        
        // NOVO PADRÃO: prefixo é "unidade_codigo" (ex: rio-verde_14100)
        let guessedCompositeId = (prefix && prefix.includes('_')) ? prefix : null;

        let targetDocId: string | null = null;

        if (guessedCompositeId) {
          const docRef = doc(db, "users", guessedCompositeId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            targetDocId = guessedCompositeId;
            
            // HANDSHAKE: If UID is missing or different, update it
            const data = docSnap.data();
            if (data.uid !== user.uid) {
              console.log(`Handshake: Updating UID for ${guessedCompositeId}`);
              await updateDoc(docRef, { uid: user.uid });
            }
          }
        }

        // 2. Fallback 1: Search by franquiaId and codigo (Using the composite index shown in user screenshot)
        if (!targetDocId && guessedCompositeId && guessedCompositeId.includes('_')) {
          const [fId, cod] = guessedCompositeId.split('_');
          const qComp = query(
            collection(db, "users"),
            where("franquiaId", "==", fId),
            where("codigo", "==", cod),
            limit(1)
          );
          const querySnapComp = await getDocs(qComp);
          if (!querySnapComp.empty) {
            const snap = querySnapComp.docs[0];
            targetDocId = snap.id;
            
            // HANDSHAKE: Update UID if found via composite fields
            if (snap.data().uid !== user.uid) {
              console.log(`Handshake (via composite fields): Updating UID for ${targetDocId}`);
              await updateDoc(doc(db, "users", targetDocId), { uid: user.uid });
            }
          }
        }

        // 3. Fallback 2: Search by email (Most reliable if compositeId guess fails)
        if (!targetDocId && email) {
          const qEmail = query(collection(db, "users"), where("email", "==", email), limit(1));
          const querySnapEmail = await getDocs(qEmail);
          if (!querySnapEmail.empty) {
            const snap = querySnapEmail.docs[0];
            targetDocId = snap.id;
            
            // HANDSHAKE: Update UID if found via email
            if (snap.data().uid !== user.uid) {
              console.log(`Handshake (via email): Updating UID for ${targetDocId}`);
              await updateDoc(doc(db, "users", targetDocId), { uid: user.uid });
            }
          }
        }

        // 3. Fallback 2: Search by codigo AND email (Safe and allowed by rules)
        // This handles cases where the franquiaId in the ID doesn't match the email domain.
        if (!targetDocId && prefix && /^\d+$/.test(prefix)) {
          const qCodigo = query(
            collection(db, "users"), 
            where("codigo", "==", prefix), 
            where("email", "==", email),
            limit(1)
          );
          const querySnapCodigo = await getDocs(qCodigo);
          if (!querySnapCodigo.empty) {
            const snap = querySnapCodigo.docs[0];
            targetDocId = snap.id;
            
            // HANDSHAKE: Update UID if found via codigo
            if (snap.data().uid !== user.uid) {
              console.log(`Handshake (via codigo): Updating UID for ${targetDocId}`);
              await updateDoc(doc(db, "users", targetDocId), { uid: user.uid });
            }
          }
        }
 
        // 4. Fallback 3: Search by UID field (for Master/Staff or already linked accounts)
        if (!targetDocId) {
          const qUid = query(collection(db, "users"), where("uid", "==", user.uid), limit(1));
          const querySnapUid = await getDocs(qUid);
          if (!querySnapUid.empty) {
            targetDocId = querySnapUid.docs[0].id;
          }
        }

        if (targetDocId) {
          // Set up real-time listener on the FOUND document
          unsubProfile = onSnapshot(doc(db, "users", targetDocId), (s) => {
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
                updateDoc(doc(db, "users", targetDocId!), { lastLogin: serverTimestamp() }).catch(console.error);
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
          console.warn("No profile found for user:", user.email || user.uid);
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
