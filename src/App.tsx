"use client";

import { useAuth } from "./hooks/useAuth";
import Auth from "./components/Auth";
import StudentDashboard from "./components/StudentDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import AdminDashboard from "./components/AdminDashboard";
import CourseLobby from "./components/CourseLobby";
import { motion, AnimatePresence } from "motion/react";
import { Rocket, LogOut } from "lucide-react";
import { auth, db } from "./firebase";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { Enrollment } from "./types";

export default function App() {
  const { user, profile, loading, migrationStatus } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [showLobby, setShowLobby] = useState(false);

  useEffect(() => {
    if (user && profile?.role === "aluno") {
      // Use profile.uid which is the official ID (composite or legacy)
      const targetId = profile.uid || user.uid;
      
      const unsub = onSnapshot(collection(db, "users", targetId, "enrollments"), (snap) => {
        const list = snap.docs.map(d => d.data() as Enrollment);
        setEnrollments(list);
        
        // If multiple enrollments and no currentCourseId, show lobby
        if (list.length > 1 && !profile.currentCourseId) {
          setShowLobby(true);
        } else if (list.length === 1 && !profile.currentCourseId) {
          // Auto-select the only course - ONLY if not a legacy profile (ID != UID)
          // This prevents frontend writes during migration
          if (targetId !== user.uid) {
            updateDoc(doc(db, "users", targetId), {
              currentCourseId: list[0].courseId
            }).catch(console.error);
          }
          setShowLobby(false);
        } else {
          setShowLobby(false);
        }
      }, (err) => {
        // If we get permission denied on a legacy profile, it's likely because it's being migrated
        if (err.code === "permission-denied" && targetId === user.uid) {
          console.warn("Permission denied on legacy enrollments. This is expected during migration.");
          return;
        }
        console.error("Error in enrollments snapshot:", err);
      });
      return () => unsub();
    }
  }, [user, profile?.role, profile?.currentCourseId, profile?.uid]);

  if (loading || migrationStatus === "migrating") {
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
          {migrationStatus === "migrating" ? "Migrando Perfil Legado..." : "Iniciando Sistemas..."}
        </p>
      </div>
    );
  }

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
        ) : profile ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {profile.role === "aluno" ? (
              showLobby ? (
                <CourseLobby 
                  profile={profile} 
                  enrollments={enrollments} 
                  onSelect={() => setShowLobby(false)} 
                />
              ) : (
                <StudentDashboard profile={profile} />
              )
            ) : profile.role === "professor" ? (
              <TeacherDashboard profile={profile} />
            ) : (
              <AdminDashboard profile={profile} />
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
