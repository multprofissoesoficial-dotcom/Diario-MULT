"use client";

import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  increment, 
  getDoc,
  setDoc,
  limit,
  startAfter,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import { Mission, UserProfile } from "../types";
import { XP_PER_MISSION, XP_BONUS } from "../constants";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, Zap, Clock, User as UserIcon, FileText, Search, Filter, LogOut, Rocket, UserPlus, Eye } from "lucide-react";
import { auth } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/utils";
import MissionHistoryModal from "./MissionHistoryModal";

export default function TeacherDashboard({ profile }: { profile: UserProfile }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"missions" | "students">("missions");
  const [showEditStudent, setShowEditStudent] = useState<UserProfile | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showMissionHistory, setShowMissionHistory] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    codigo: "",
    senha: "",
    role: "aluno" as any,
    franquiaId: profile.franquiaId || "",
    turma: ""
  });
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [turmaFilter, setTurmaFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastMissionDoc, setLastMissionDoc] = useState<any>(null);
  const [hasMoreMissions, setHasMoreMissions] = useState(true);
  const [lastStudentDoc, setLastStudentDoc] = useState<any>(null);
  const [hasMoreStudents, setHasMoreStudents] = useState(true);
  const studentsPerPage = 50;

  useEffect(() => {
    fetchMissions(true);
  }, [filter, profile.franquiaId, searchQuery]);

  const fetchMissions = async (reset = false) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, "missions"), 
        where("franquiaId", "==", profile.franquiaId),
        orderBy("createdAt", "desc"),
        limit(studentsPerPage)
      );

      if (filter === "pending") {
        q = query(q, where("status", "==", "pending"));
      }

      if (!reset && lastMissionDoc) {
        q = query(q, startAfter(lastMissionDoc));
      }

      const snap = await getDocs(q);
      const newMissions = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission));
      
      if (reset) {
        setMissions(newMissions);
      } else {
        setMissions(prev => [...prev, ...newMissions]);
      }

      setLastMissionDoc(snap.docs[snap.docs.length - 1]);
      setHasMoreMissions(snap.docs.length === studentsPerPage);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, "missions");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMissions = () => {
    if (!loading && hasMoreMissions) {
      fetchMissions();
    }
  };

  useEffect(() => {
    fetchStudents(true);
  }, [profile.franquiaId, turmaFilter, searchQuery]);

  const fetchStudents = async (reset = false) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, "users"), 
        where("role", "==", "aluno"), 
        where("franquiaId", "==", profile.franquiaId),
        orderBy("displayName"),
        limit(studentsPerPage)
      );

      if (turmaFilter !== "all") {
        q = query(q, where("turma", "==", turmaFilter));
      }

      if (!reset && lastStudentDoc) {
        q = query(q, startAfter(lastStudentDoc));
      }

      const snap = await getDocs(q);
      const newStudents = snap.docs.map(d => d.data() as UserProfile);
      
      if (reset) {
        setStudents(newStudents);
      } else {
        setStudents(prev => [...prev, ...newStudents]);
      }

      setLastStudentDoc(snap.docs[snap.docs.length - 1]);
      setHasMoreStudents(snap.docs.length === studentsPerPage);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, "users");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreStudents = () => {
    if (!loading && hasMoreStudents) {
      fetchStudents();
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUser.nome || !newUser.senha) {
      alert("Nome e Senha são obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar usuário");
      }

      setNewUser({ 
        nome: "", 
        email: "", 
        codigo: "", 
        senha: "", 
        role: "aluno", 
        franquiaId: profile.franquiaId || "",
        turma: ""
      });
      setShowAddUser(false);
      fetchStudents(true);
    } catch (err: any) {
      console.error("Erro ao criar usuário:", err);
      alert("Erro ao criar usuário: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditStudent) return;
    setLoading(true);

    try {
      await setDoc(doc(db, "users", showEditStudent.uid), showEditStudent, { merge: true });
      setShowEditStudent(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${showEditStudent.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (mission: Mission, bonus: boolean) => {
    setLoading(true);
    const xp = bonus ? XP_BONUS : XP_PER_MISSION;

    try {
      // Update mission status and student XP in parallel for faster real-time feedback
      await Promise.all([
        updateDoc(doc(db, "missions", mission.id), {
          status: bonus ? "bonus" : "approved",
          xpAwarded: xp
        }),
        updateDoc(doc(db, "users", mission.studentId), {
          xp: increment(xp)
        })
      ]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `missions/${mission.id} & users/${mission.studentId}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredMissions = missions;
  const filteredStudents = students;
  const currentStudents = students;
  const totalPages = 1;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-mult-orange/20 rounded-xl flex items-center justify-center neon-glow-orange border border-mult-orange/30">
            <Rocket className="text-mult-orange w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter leading-none">MULT <span className="text-mult-orange">PROFISSÕES</span></h1>
            <p className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Central do Professor • Mestre {profile.displayName.split(' ')[0]}</p>
          </div>
        </div>
        <button 
          onClick={() => auth.signOut()}
          className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Stats & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Pendentes</p>
            <p className="text-xl sm:text-2xl font-bold">{missions.filter(m => m.status === "pending").length}</p>
          </div>
        </div>
        <div className="md:col-span-2 glass-card p-4 flex flex-col sm:flex-row items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={() => setView("missions")}
                className={`px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${view === "missions" ? "bg-mult-orange text-white neon-glow-orange" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
              >
                Missões
              </button>
              <button 
                onClick={() => setView("students")}
                className={`px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${view === "students" ? "bg-mult-orange text-white neon-glow-orange" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
              >
                Alunos
              </button>
            </div>
            <div className="h-4 w-px bg-white/10 mx-1 shrink-0 hidden sm:block" />
            {view === "missions" ? (
              <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input 
                    type="text"
                    placeholder="Buscar missão..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-black/20 border border-white/10 rounded-full text-[10px] focus:outline-none focus:border-neon-blue transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFilter("pending")}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${filter === "pending" ? "bg-neon-blue/20 text-neon-blue" : "bg-white/5 text-gray-500"}`}
                  >
                    Pendentes
                  </button>
                  <button 
                    onClick={() => setFilter("all")}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${filter === "all" ? "bg-neon-blue/20 text-neon-blue" : "bg-white/5 text-gray-500"}`}
                  >
                    Todas
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowAddUser(true)}
                className="bg-mult-orange hover:bg-mult-orange/90 text-white font-bold py-1.5 px-4 rounded-full transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 neon-glow-orange"
              >
                <UserPlus className="w-3.5 h-3.5" /> Novo Usuário
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content View */}
      <div className="space-y-4">
        {view === "missions" ? (
          <AnimatePresence mode="popLayout">
            {filteredMissions.map((mission) => (
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 shrink-0">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-base sm:text-lg leading-tight">{mission.studentName}</h4>
                          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest font-bold">
                            {mission.module} • Aula {mission.classNum}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-xs text-gray-600 font-mono">
                        {new Date(mission.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 relative group">
                      <FileText className="absolute top-4 right-4 w-4 h-4 text-gray-700 group-hover:text-mult-orange transition-colors hidden sm:block" />
                      <p className="text-gray-300 text-sm sm:text-base leading-relaxed whitespace-pre-wrap italic">
                        "{mission.content}"
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col gap-3 justify-center">
                    {mission.status === "pending" ? (
                      <>
                        <button 
                          onClick={() => handleApprove(mission, false)}
                          disabled={loading}
                          className="flex-1 md:flex-none bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue border border-neon-blue/30 font-bold py-3 px-4 sm:px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] sm:text-sm uppercase tracking-widest disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" /> <span className="hidden sm:inline">Aprovar</span> (+50 XP)
                        </button>
                        <button 
                          onClick={() => handleApprove(mission, true)}
                          disabled={loading}
                          className="flex-1 md:flex-none bg-mult-orange/20 hover:bg-mult-orange/30 text-mult-orange border border-mult-orange/30 font-bold py-3 px-4 sm:px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] sm:text-sm uppercase tracking-widest disabled:opacity-50 neon-glow-orange"
                        >
                          <Zap className="w-4 h-4" /> <span className="hidden sm:inline">Bônus</span> (+100 XP)
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-neon-blue font-bold uppercase tracking-widest text-[10px] sm:text-xs bg-neon-blue/10 px-4 py-2 rounded-full border border-neon-blue/20">
                        <CheckCircle className="w-4 h-4" /> Validado (+{mission.xpAwarded} XP)
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {missions.length === 0 && (
              <div className="text-center py-20 glass-card">
                <Clock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 italic">Nenhuma missão pendente no radar.</p>
              </div>
            )}
            {hasMoreMissions && (
              <div className="flex justify-center py-4">
                <button 
                  onClick={loadMoreMissions}
                  disabled={loading}
                  className="px-8 py-3 rounded-xl bg-mult-orange text-white font-black uppercase tracking-widest text-xs neon-glow-orange disabled:opacity-50 transition-all"
                >
                  Carregar Mais Missões
                </button>
              </div>
            )}
          </AnimatePresence>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Gestão de Alunos</h3>
                <select 
                  value={turmaFilter}
                  onChange={(e) => setTurmaFilter(e.target.value)}
                  className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-neon-blue transition-all"
                >
                  <option value="all">Todas as Turmas</option>
                  {Array.from(new Set(students.filter(u => u.turma).map(u => u.turma))).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text"
                  placeholder="Buscar por nome ou código..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-neon-blue transition-all"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                    <th className="px-4 sm:px-6 py-4">Aluno</th>
                    <th className="px-4 sm:px-6 py-4">Código</th>
                    <th className="px-4 sm:px-6 py-4">XP Atual</th>
                    <th className="px-4 sm:px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentStudents.map((student) => (
                    <tr key={student.uid} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 shrink-0">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{student.displayName}</p>
                            <p className="text-[10px] text-gray-600 font-mono truncate">{student.email || student.codigo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className="text-xs font-bold text-gray-400 font-mono">
                          {student.codigo || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 font-bold text-sm text-neon-blue shrink-0">{student.xp} XP</td>
                      <td className="px-4 sm:px-6 py-4 text-right shrink-0">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setShowMissionHistory(student)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-neon-blue/20 hover:text-neon-blue transition-all text-gray-600"
                            title="Ver Histórico de Missões"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setShowEditStudent(student)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-mult-orange/20 hover:text-mult-orange transition-all text-gray-600"
                            title="Editar XP"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {currentStudents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center text-gray-600 italic">
                        Nenhum aluno encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Load More Students */}
            {hasMoreStudents && (
              <div className="p-6 border-t border-white/5 bg-white/5 flex justify-center">
                <button 
                  onClick={loadMoreStudents}
                  disabled={loading}
                  className="px-8 py-3 rounded-xl bg-mult-orange text-white font-black uppercase tracking-widest text-xs neon-glow-orange disabled:opacity-50 transition-all"
                >
                  Carregar Mais Alunos
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {showEditStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-md p-8 space-y-6 relative"
            >
              <h2 className="text-2xl font-black tracking-tighter">EDITAR <span className="text-mult-orange">ALUNO</span></h2>
              <form onSubmit={handleUpdateStudent} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">XP do Aluno</label>
                  <input 
                    type="number"
                    value={showEditStudent.xp}
                    onChange={e => setShowEditStudent({...showEditStudent, xp: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-mult-orange"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowEditStudent(null)}
                    className="flex-1 bg-white/5 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    disabled={loading}
                    className="flex-1 bg-mult-orange text-white font-bold py-3 rounded-xl transition-all neon-glow-orange"
                  >
                    SALVAR
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add User Modal */}
      <AnimatePresence>
        {showAddUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-md p-8 space-y-6 relative"
            >
              <h2 className="text-2xl font-black tracking-tighter uppercase">NOVO <span className="text-mult-orange">ALUNO</span></h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    required
                    type="text"
                    value={newUser.nome}
                    onChange={e => setNewUser({...newUser, nome: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-mult-orange"
                    placeholder="Nome do aluno"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">E-mail (Opcional)</label>
                  <input 
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-mult-orange"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Código/Matrícula</label>
                  <input 
                    type="text"
                    value={newUser.codigo}
                    onChange={e => setNewUser({...newUser, codigo: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-mult-orange"
                    placeholder="Ex: 123456"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Senha de Acesso</label>
                  <input 
                    required
                    type="password"
                    value={newUser.senha}
                    onChange={e => setNewUser({...newUser, senha: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-mult-orange"
                    placeholder="Senha inicial"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Turma</label>
                  <input 
                    type="text"
                    value={newUser.turma}
                    onChange={e => setNewUser({...newUser, turma: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-mult-orange"
                    placeholder="Ex: Turma A"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="flex-1 bg-white/5 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    disabled={loading}
                    className="flex-1 bg-mult-orange text-white font-bold py-3 rounded-xl transition-all neon-glow-orange disabled:opacity-50"
                  >
                    {loading ? "CRIANDO..." : "CRIAR ALUNO"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mission History Modal */}
      <AnimatePresence>
        {showMissionHistory && (
          <MissionHistoryModal 
            student={showMissionHistory} 
            onClose={() => setShowMissionHistory(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
