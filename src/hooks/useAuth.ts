import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";
import { supabase } from "../lib/supabase";
import { UserProfile } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        document.cookie = "user_uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
        document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
        return;
      }

      try {
        setLoading(true);
        const userEmail = (firebaseUser.email || "").toLowerCase().trim();
        let foundData = null;

        // 1. Busca Otimizada: Procura diretamente o e-mail no banco, vencendo o limite de 1000 linhas
        if (userEmail) {
          const { data: dataEmail, error: emailError } = await supabase
            .from("usuarios")
            .select("*")
            .ilike("email", userEmail)
            .maybeSingle();

          if (dataEmail) {
            foundData = dataEmail;
          }
        }

        // 2. Fallback: Tenta por UID do Firebase caso o e-mail não seja encontrado
        if (!foundData && firebaseUser.uid) {
          const { data: dataUid } = await supabase
            .from("usuarios")
            .select("*")
            .or(`uid.eq.${firebaseUser.uid},id.eq.${firebaseUser.uid}`)
            .maybeSingle();

          if (dataUid) foundData = dataUid;
        }

        if (foundData) {
          const mappedProfile: UserProfile = {
            id: foundData.id,
            uid: foundData.uid || firebaseUser.uid,
            email: foundData.email,
            displayName: foundData.display_name,
            codigo: foundData.codigo,
            role: foundData.role,
            franquiaId: foundData.franquia_id,
            turma: foundData.turma,
            xp: foundData.xp || 0,
            skills: foundData.skills || [],
            resumeUrl: foundData.resume_url,
            availabilityStatus: foundData.availability_status,
            withdrawalReason: foundData.withdrawal_reason,
            unlockedBadges: foundData.unlocked_badges || [],
            currentCourseId: foundData.current_course_id || "INF",
            atsTermsAccepted: Boolean(foundData.ats_terms_accepted),
            atsTermsAcceptedAt: foundData.ats_terms_accepted_at,
            perceptions: foundData.perceptions || {},
            employmentHistory: foundData.employment_history || [],
            createdAt: foundData.created_at,
            lastLogin: foundData.last_login
          };

          setProfile(mappedProfile);
          document.cookie = `user_uid=${firebaseUser.uid}; path=/; max-age=86400; SameSite=None; Secure`;
          document.cookie = `user_role=${mappedProfile.role}; path=/; max-age=86400; SameSite=None; Secure`;
        } else {
          console.warn("Nenhum perfil encontrado no Supabase para:", firebaseUser.email);
          setProfile(null);
        }
      } catch (err) {
        console.error("Erro crítico ao buscar perfil no Supabase:", err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, profile, loading };
}
