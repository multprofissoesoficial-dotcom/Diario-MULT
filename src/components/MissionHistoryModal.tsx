"use client";

import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  limit
} from "firebase/firestore";
import { db } from "../firebase";
import { Mission, UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Clock, FileText, CheckCircle, Zap, X, Calendar } from "lucide-react";
import { cn } from "../lib/utils";

interface MissionHistoryModalProps {
  student: UserProfile;
  onClose: () => void;
}

export default function MissionHistoryModal({ student, onClose }: MissionHistoryModalProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  useEffect(() => {
    const fetchMissions = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "missions"),
          where("studentId", "==", student.uid),
          orderBy("createdAt", "desc"),
          limit(50)
        );
        const snap = await getDocs(q);
        setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission)));
      } catch (err) {
        console.error("Error fetching student missions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMissions();
  }, [student.uid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange border border-mult-orange/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter uppercase">HISTÓRICO DE <span className="text-mult-orange">MISSÕES</span></h2>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
                Aluno: {student.displayName} • {student.turma || "Sem Turma"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* List */}
          <div className="w-full md:w-1/3 border-r border-white/10 overflow-y-auto p-4 space-y-3 bg-black/20">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-mult-orange border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Carregando...</p>
              </div>
            ) : missions.length === 0 ? (
              <div className="text-center py-20 space-y-2">
                <Clock className="w-8 h-8 text-gray-700 mx-auto" />
                <p className="text-xs text-gray-500 italic">Nenhuma missão encontrada.</p>
              </div>
            ) : (
              missions.map((mission) => (
                <button
                  key={mission.id}
                  onClick={() => setSelectedMission(mission)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1",
                    selectedMission?.id === mission.id 
                      ? "bg-mult-orange/20 border-mult-orange/50 neon-glow-orange" 
                      : "bg-white/5 border-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Aula {mission.classNum}</span>
                    <span className="text-[9px] font-mono text-gray-600">{new Date(mission.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold text-sm truncate">{mission.module}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      mission.status === 'approved' || mission.status === 'bonus' ? "bg-neon-blue" : "bg-yellow-500"
                    )} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                      {mission.status === 'approved' ? 'Aprovada' : mission.status === 'bonus' ? 'Bônus' : 'Pendente'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Details */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-black/40">
            {selectedMission ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={selectedMission.id}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter uppercase">{selectedMission.module}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-bold">{new Date(selectedMission.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold">Aula {selectedMission.classNum}</span>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-xl border font-black uppercase tracking-widest text-xs",
                    selectedMission.status === 'approved' || selectedMission.status === 'bonus' 
                      ? "bg-neon-blue/10 text-neon-blue border-neon-blue/20" 
                      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                  )}>
                    {selectedMission.status === 'approved' ? 'Aprovada' : selectedMission.status === 'bonus' ? 'Bônus' : 'Pendente'}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Conteúdo do Diário</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10 min-h-[200px] shadow-inner">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap italic text-lg">
                      "{selectedMission.content}"
                    </p>
                  </div>
                </div>

                {selectedMission.xpAwarded && (
                  <div className="flex items-center gap-6 p-6 bg-neon-blue/10 rounded-2xl border border-neon-blue/20">
                    <div className="w-14 h-14 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue neon-glow-blue">
                      <Zap className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Recompensa</p>
                      <p className="text-3xl font-black text-neon-blue">+{selectedMission.xpAwarded} XP</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                <FileText className="w-20 h-20 text-gray-700" />
                <p className="text-lg font-bold uppercase tracking-widest">Selecione uma missão para visualizar os detalhes</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs transition-all"
          >
            Fechar Relatório
          </button>
        </div>
      </motion.div>
    </div>
  );
}
