"use client";

import { useAuth } from "./hooks/useAuth";
import Auth from "./components/Auth";
import StudentDashboard from "./components/StudentDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import AdminDashboard from "./components/AdminDashboard";
import CourseLobby from "./components/CourseLobby";
import { motion, AnimatePresence } from "motion/react";
import { Rocket, LogOut } from "lucide-react";
import { auth } from "./firebase";
import { supabase } from "./lib/supabase";
import { useState, useEffect } from "react";
import { Enrollment } from "./types";

export default function App() {
  const { user, profile, loading } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [showLobby, setShowLobby] = useState(false);

  // 🔥 BLINDAGEM MÁXIMA DE ROTEAMENTO 🔥
  // Intercepta a leitura do banco de dados. Se o e-mail for da diretoria,
  // sobrepõe qualquer cargo duplicado ("aluno") e força o acesso como Master.
  const masterEmails = ["faustodv@gmail.com", "selane@mult.com.br"];
  const isDirector = profile?.email && masterEmails.includes(profile.email.toLowerCase().trim());
  const effectiveRole = isDirector ? "master" : profile?.role;

  useEffect(() => {
    let isMounted = true;

    async function fetchEnrollments() {
      // Usamos a regra blindada (effectiveRole) para não carregar rotinas de aluno no seu perfil
      if (user && effectiveRole === "aluno") {
        const targetId = profile!.id;
        
        try {
          const { data, error } = await supabase
            .from("matriculas")
            .select("*")
            .eq("aluno_id", targetId);

          if (!isMounted) return;

          if (!error && data) {
            const list: Enrollment[] = data.map((d: any) => ({
              id: d.id || `${d.aluno_id}_${d.course_id}`,
              courseId: d.course_id || d.courseId || "INF",
              courseName: d.course_name || d.courseName || "Informática",
              currentLesson: d.current_lesson || 1,
              status: d.status || "ativo",
              enrolledAt: d.enrolled_at || d.enrolledAt || new Date().toISOString(),
              unlockedBadges: d.unlocked_badges || d.unlockedBadges || []
            }));
            
            setEnrollments(list);

            if (list.length > 1 && !profile!.currentCourseId) {
              setShowLobby(true);
            } else if (list.length === 1 && !profile!.currentCourseId) {
              await supabase
                .from("usuarios")
                .update({ current_course_id: list[0].courseId })
                .eq("id", targetId);
              setShowLobby(false);
            } else {
              setShowLobby(false);
            }
          }
        } catch (err) {
          console.error("Erro ao buscar matrículas no Supabase:", err);
        }
      }
    }

    fetchEnrollments();

    return () => {
      isMounted = false;
    };
  }, [user, effectiveRole, profile?.currentCourseId, profile?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cockpit-bg flex flex-col items-center justify-center gap-4">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 bg-mult-orange/20 rounded-full flex items-center justify-center neon-glow-orange"
        >
          <Rocket className="text-mult-orange w-8 h-8" />
        </motion.div>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.3em] animate-pulse">
          Iniciando Sistemas...
        </p>
      </div>
    );
  }

  // Cria um perfil seguro garantindo que o AdminDashboard receba a credencial Master
  const safeProfile = profile ? { ...profile, role: effectiveRole as any } : null;

  return (
    <div className="min-h-screen bg-cockpit-bg selection:bg-neon-blue selection:text-black">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div 
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Auth onSeedClick={() => {}} />
          </motion.div>
        ) : safeProfile ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {effectiveRole === "aluno" ? (
              showLobby ? (
                <CourseLobby 
                  profile={safeProfile} 
                  enrollments={enrollments} 
                  onSelect={() => setShowLobby(false)} 
                />
              ) : (
                <StudentDashboard profile={safeProfile} />
              )
            ) : effectiveRole === "professor" ? (
              <TeacherDashboard profile={safeProfile} />
            ) : (
              <AdminDashboard profile={safeProfile} />
            )}
          </motion.div>
        ) : (
          <div className="min-h-screen flex flex-col items-center justify-center bg-cockpit-bg p-6 text-center">
            <div className="glass-card p-8 max-w-md space-y-6 border-red-500/30">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <Rocket className="text-red-500 w-8 h-8 rotate-180" />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Erro de Sincronização</h2>
                  <p className="text-gray-400 text-sm">
                    Sua conta de acesso existe, mas seu perfil de aluno/colaborador não foi encontrado no banco de dados.
                  </p>
                  <p className="text-[10px] text-red-400/60 uppercase tracking-widest font-bold">
                    Verifique o Console (F12) para detalhes técnicos.
                  </p>
                </div>
                
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-left space-y-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dados Técnicos</p>
                  <p className="text-[10px] font-mono text-gray-400 break-all">UID: {user.uid}</p>
                  <p className="text-[10px] font-mono text-gray-400 break-all">E-mail: {user.email}</p>
                </div>

                <p className="text-gray-500 text-[10px] italic uppercase tracking-widest">
                  Informe os dados acima ao seu Coordenador para regularizar seu acesso.
                </p>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> VOLTAR AO LOGIN
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
