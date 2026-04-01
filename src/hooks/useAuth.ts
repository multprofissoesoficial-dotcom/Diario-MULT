import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, getDocs, setDoc, query, where, limit, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile } from "../types";

enum OperationType {
  GET = 'get',
  LIST = 'list',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

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
      console.log("Iniciando busca de perfil para:", user.email);
      try {
        const email = user.email?.toLowerCase() || "";
        const [prefix] = email.split('@');
        let guessedCompositeId = (prefix && prefix.includes('_')) ? prefix : null;
        let targetDocId: string | null = null;

        // 1. Tenta por ID Composto (Prefixo do E-mail)
        if (guessedCompositeId) {
          console.log("Tentativa 1: Buscando por ID Composto:", guessedCompositeId);
          try {
            const docRef = doc(db, "users", guessedCompositeId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              targetDocId = guessedCompositeId;
              console.log("Perfil encontrado por ID Composto!");
              if (docSnap.data().uid !== user.uid) {
                await updateDoc(docRef, { uid: user.uid });
              }
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, `users/${guessedCompositeId}`);
          }
        }

        // 2. Tenta por Campos Compostos (franquiaId + codigo)
        if (!targetDocId && guessedCompositeId && guessedCompositeId.includes('_')) {
          const [fId, cod] = guessedCompositeId.split('_');
          console.log("Tentativa 2: Buscando por campos franquiaId e codigo:", fId, cod);
          try {
            const qComp = query(collection(db, "users"), where("franquiaId", "==", fId), where("codigo", "==", cod), limit(1));
            const querySnapComp = await getDocs(qComp);
            if (!querySnapComp.empty) {
              targetDocId = querySnapComp.docs[0].id;
              console.log("Perfil encontrado por campos compostos!");
              if (querySnapComp.docs[0].data().uid !== user.uid) {
                await updateDoc(doc(db, "users", targetDocId), { uid: user.uid });
              }
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.LIST, "users (composite query)");
          }
        }

        // 3. Tenta por E-mail
        if (!targetDocId && email) {
          console.log("Tentativa 3: Buscando por e-mail:", email);
          try {
            const qEmail = query(collection(db, "users"), where("email", "==", email), limit(1));
            const querySnapEmail = await getDocs(qEmail);
            if (!querySnapEmail.empty) {
              targetDocId = querySnapEmail.docs[0].id;
              console.log("Perfil encontrado por e-mail!");
              if (querySnapEmail.docs[0].data().uid !== user.uid) {
                await updateDoc(doc(db, "users", targetDocId), { uid: user.uid });
              }
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.LIST, "users (email query)");
          }
        }

        // 4. Tenta por UID
        if (!targetDocId) {
          console.log("Tentativa 4: Buscando por UID:", user.uid);
          try {
            const qUid = query(collection(db, "users"), where("uid", "==", user.uid), limit(1));
            const querySnapUid = await getDocs(qUid);
            if (!querySnapUid.empty) {
              targetDocId = querySnapUid.docs[0].id;
              console.log("Perfil encontrado por UID!");
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.LIST, "users (uid query)");
          }
        }

        if (targetDocId) {
          console.log("Estabelecendo listener em tempo real para:", targetDocId);
          unsubProfile = onSnapshot(doc(db, "users", targetDocId), (s) => {
            if (s.exists()) {
              const profileData = { ...s.data() as UserProfile, id: s.id };
              setProfile(profileData);
              document.cookie = `user_uid=${user.uid}; path=/; max-age=86400; SameSite=None; Secure`;
              document.cookie = `user_role=${profileData.role}; path=/; max-age=86400; SameSite=None; Secure`;
              setLoading(false);
            } else {
              setProfile(null);
              setLoading(false);
            }
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${targetDocId} (snapshot)`);
            setProfile(null);
            setLoading(false);
          });
        } else {
          console.warn("Nenhum perfil encontrado para o usuário após todas as tentativas.");
          setProfile(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Erro crítico na busca de perfil:", err);
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
