import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Mission, UserProfile } from "../types";
import { XP_PER_MISSION, XP_BONUS } from "../constants";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle, 
  Zap, 
  Clock, 
  User as UserIcon, 
  FileText, 
  Search,
  Filter,
  LogOut,
  Rocket
} from "lucide-react";
import { auth } from "../firebase";

export default function TeacherDashboard({ profile }: { profile: UserProfile }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  useEffect(() => {
    // Filter by franchise
    const q = filter === "pending" 
      ? query(collection(db, "missions"), where("status", "==", "pending"), where("franquiaId", "==", profile.franquiaId), orderBy("createdAt", "desc"))
      : query(collection(db, "missions"), where("franquiaId", "==", profile.franquiaId), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission)));
    });

    return () => unsubscribe();
  }, [filter, profile.franquiaId]);

  const handleApprove = async (mission: Mission, bonus: boolean) => {
    setLoading(true);
    const xp = bonus ? XP_BONUS : XP_PER_MISSION;

    try {
      // Update mission status
      await updateDoc(doc(db, "missions", mission.id), {
        status: bonus ? "bonus" : "approved",
        xpAwarded: xp
      });

      // Update student XP
      await updateDoc(doc(db, "users", mission.studentId), {
        xp: increment(xp)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-mult-orange/20 rounded-xl flex items-center justify-center neon-glow-orange border border-mult-orange/30">
            <Rocket className="text-mult-orange w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none">MULT <span className="text-mult-orange">PROFISSÕES</span></h1>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Central do Professor • Mestre {profile.displayName.split(' ')[0]}</p>
          </div>
        </div>
        <button 
          onClick={() => auth.signOut()}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Stats & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pendentes</p>
            <p className="text-2xl font-bold">{missions.filter(m => m.status === "pending").length}</p>
          </div>
        </div>
        <div className="md:col-span-2 glass-card p-4 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex gap-2">
              <button 
                onClick={() => setFilter("pending")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${filter === "pending" ? "bg-mult-orange text-white neon-glow-orange" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
              >
                Pendentes
              </button>
              <button 
                onClick={() => setFilter("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${filter === "all" ? "bg-mult-orange text-white neon-glow-orange" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
              >
                Todas
              </button>
            </div>
          </div>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar aluno..." 
              className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-mult-orange transition-all w-64"
            />
          </div>
        </div>
      </div>

      {/* Missions List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {missions.map((mission) => (
            <motion.div 
              key={mission.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 border-l-4 border-l-mult-orange/50"
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{mission.studentName}</h4>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                          {mission.module} • Aula {mission.classNum}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 font-mono">
                      {new Date(mission.createdAt).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5 relative group">
                    <FileText className="absolute top-4 right-4 w-4 h-4 text-gray-700 group-hover:text-mult-orange transition-colors" />
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap italic">
                      "{mission.content}"
                    </p>
                  </div>
                </div>

                <div className="flex md:flex-col gap-3 justify-center">
                  {mission.status === "pending" ? (
                    <>
                      <button 
                        onClick={() => handleApprove(mission, false)}
                        disabled={loading}
                        className="flex-1 md:flex-none bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue border border-neon-blue/30 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Aprovar (+50 XP)
                      </button>
                      <button 
                        onClick={() => handleApprove(mission, true)}
                        disabled={loading}
                        className="flex-1 md:flex-none bg-mult-orange/20 hover:bg-mult-orange/30 text-mult-orange border border-mult-orange/30 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest disabled:opacity-50 neon-glow-orange"
                      >
                        <Zap className="w-4 h-4" /> Bônus (+100 XP)
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-neon-blue font-bold uppercase tracking-widest text-xs bg-neon-blue/10 px-4 py-2 rounded-full border border-neon-blue/20">
                      <CheckCircle className="w-4 h-4" /> Validado (+{mission.xpAwarded} XP)
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {missions.length === 0 && (
          <div className="text-center py-20 glass-card">
            <Clock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 italic">Nenhuma missão pendente no radar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
