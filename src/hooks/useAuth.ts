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

        // 1. Busca Otimizada em Array: Traz TODOS os registros vinculados ao e-mail
        if (userEmail) {
          const { data: dataEmails, error: emailError } = await supabase
            .from("usuarios")
            .select("*")
            .ilike("email", userEmail);

          if (dataEmails && dataEmails.length > 0) {
            // BLINDAGEM MÁXIMA DE HIERARQUIA: 
            // Se houver perfis duplicados (ex: importou o master como aluno sem querer),
            // o sistema varre a lista e FORÇA o login na conta com o cargo mais alto.
            foundData = dataEmails.find(d => String(d.role).toLowerCase().trim() === "master")
                     || dataEmails.find(d => String(d.role).toLowerCase().trim() === "coordenador")
                     || dataEmails.find(d => String(d.role).toLowerCase().trim() === "rh")
                     || dataEmails.find(d => String(d.role).toLowerCase().trim() === "professor")
                     || dataEmails[0]; // Se só houver aluno, entra como aluno
          }
        }

        // 2. Fallback: Tenta por UID do Firebase caso o e-mail não seja encontrado
        if (!foundData && firebaseUser.uid) {
          const { data: dataUids } = await supabase
            .from("usuarios")
            .select("*")
            .or(`uid.eq.${firebaseUser.uid},id.eq.${firebaseUser.uid}`);

          if (dataUids && dataUids.length > 0) {
            // Aplica a mesma blindagem de hierarquia no fallback
            foundData = dataUids.find(d => String(d.role).toLowerCase().trim() === "master") || dataUids[0];
          }
        }

        if (foundData) {
          // Garante que a palavra "master" não tenha espaços ocultos ou maiúsculas erradas
          const safeRole = String(foundData.role || "aluno").toLowerCase().trim();

          const mappedProfile: UserProfile = {
            id: foundData.id,
            uid: foundData.uid || firebaseUser.uid,
            email: foundData.email,
            displayName: foundData.display_name,
            codigo: foundData.codigo,
            role: safeRole as any,
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
          document.cookie = `user_role=${safeRole}; path=/; max-age=86400; SameSite=None; Secure`;
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
