import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  onSnapshot,
  orderBy
} from "firebase/firestore";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { initializeApp, deleteApp, getApp } from "firebase/app";
import { db, auth } from "../firebase";
import firebaseConfig from "../../firebase-applet-config.json";
import { UserProfile, Franquia, Mission } from "../types";
import { ROLES_LABELS, RANKS } from "../constants";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Plus, 
  Building2, 
  Search, 
  Filter, 
  LogOut, 
  ChevronRight, 
  Trophy, 
  FileText,
  ShieldCheck,
  UserPlus,
  Loader2,
  CheckCircle2,
  Rocket
} from "lucide-react";

export default function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [franquias, setFranquias] = useState<Franquia[]>([]);
  const [selectedFranquia, setSelectedFranquia] = useState<string>(profile.franquiaId || "all");
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddFranquia, setShowAddFranquia] = useState(false);
  
  // Form states
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    senha: "",
    role: "aluno" as any,
    franquiaId: profile.franquiaId || ""
  });
  const [newFranquia, setNewFranquia] = useState({ id: "", nome: "", cidade: "" });
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    // Listen to Franquias
    const unsubFranquias = onSnapshot(collection(db, "franquias"), (snap) => {
      setFranquias(snap.docs.map(d => d.data() as Franquia));
    });

    return () => unsubFranquias();
  }, []);

  useEffect(() => {
    // Listen to Students
    let q = query(collection(db, "users"), where("role", "==", "aluno"));
    
    if (selectedFranquia !== "all") {
      q = query(collection(db, "users"), where("role", "==", "aluno"), where("franquiaId", "==", selectedFranquia));
    }

    const unsubStudents = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(d => d.data() as UserProfile));
    });

    return () => unsubStudents();
  }, [selectedFranquia]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");

    try {
      // Create a secondary app instance to create the user without signing out the admin
      const secondaryAppName = "secondary-" + Date.now();
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.senha);
      
      await setDoc(doc(db, "users", userCred.user.uid), {
        uid: userCred.user.uid,
        displayName: newUser.nome,
        email: newUser.email,
        role: newUser.role,
        franquiaId: newUser.franquiaId,
        xp: 0,
        unlockedBadges: [],
        createdAt: new Date().toISOString()
      });

      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      setSuccessMsg("Usuário criado com sucesso!");
      setNewUser({ nome: "", email: "", senha: "", role: "aluno", franquiaId: profile.franquiaId || "" });
      setTimeout(() => setShowAddUser(false), 2000);
    } catch (err: any) {
      alert("Erro ao criar usuário: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFranquia = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, "franquias", newFranquia.id), {
        ...newFranquia,
        createdAt: new Date().toISOString()
      });
      setSuccessMsg("Franquia criada com sucesso!");
      setNewFranquia({ id: "", nome: "", cidade: "" });
      setTimeout(() => setShowAddFranquia(false), 2000);
    } catch (err: any) {
      alert("Erro ao criar franquia: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-mult-orange/20 rounded-xl flex items-center justify-center neon-glow-orange border border-mult-orange/30">
              <Rocket className="text-mult-orange w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter leading-none">
              MULT <span className="text-mult-orange">PROFISSÕES</span>
            </h1>
          </div>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2 ml-1">
            {profile.role === "master" ? "Gestão Global Master" : `Unidade: ${franquias.find(f => f.id === profile.franquiaId)?.nome || "Carregando..."}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => auth.signOut()}
            className="p-3 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 transition-all text-gray-500 border border-white/5"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Stats & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar Unidade</span>
            </div>
            <select 
              disabled={profile.role !== "master"}
              value={selectedFranquia}
              onChange={(e) => setSelectedFranquia(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-neon-blue transition-all flex-1 md:flex-none min-w-[200px]"
            >
              {profile.role === "master" && <option value="all" className="bg-cockpit-bg">Todas as Unidades</option>}
              {franquias.map(f => (
                <option key={f.id} value={f.id} className="bg-cockpit-bg">{f.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {profile.role === "master" && (
              <button 
                onClick={() => setShowAddFranquia(true)}
                className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 px-6 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" /> Nova Franquia
              </button>
            )}
            <button 
              onClick={() => setShowAddUser(true)}
              className="flex-1 md:flex-none bg-mult-orange hover:bg-mult-orange/90 text-white font-bold py-3 px-6 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 neon-glow-orange"
            >
              <UserPlus className="w-4 h-4" /> Novo Usuário
            </button>
          </div>
        </div>

        <div className="glass-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue neon-glow-blue border border-neon-blue/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Alunos</p>
            <p className="text-2xl font-black">{students.length}</p>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Relatório de Desempenho</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                <th className="px-6 py-4">Aluno</th>
                <th className="px-6 py-4">Unidade</th>
                <th className="px-6 py-4">Nível / XP</th>
                <th className="px-6 py-4">Medalhas</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {students.map((student) => {
                const rank = RANKS.reduce((prev, curr) => (student.xp >= curr.minXP ? curr : prev), RANKS[0]);
                return (
                  <tr key={student.uid} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-neon-blue transition-colors">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{student.displayName}</p>
                          <p className="text-[10px] text-gray-600 font-mono">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-400">
                        {franquias.find(f => f.id === student.franquiaId)?.nome || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${rank.color}`}>{rank.name}</p>
                        <p className="text-xs font-bold text-gray-500">{student.xp} XP</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {student.unlockedBadges.length > 0 ? (
                          <div className="flex -space-x-2">
                            {student.unlockedBadges.map(b => (
                              <div key={b} className="w-6 h-6 rounded-full bg-mult-orange/20 border border-mult-orange/30 flex items-center justify-center text-mult-orange">
                                <Trophy className="w-3 h-3" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-700 italic">Nenhuma</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 rounded-lg bg-white/5 hover:bg-neon-blue/20 hover:text-neon-blue transition-all text-gray-600">
                        <FileText className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-600 italic">
                    Nenhum aluno encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-lg p-8 space-y-6 relative"
            >
              <button onClick={() => setShowAddUser(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
              
              <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <UserPlus className="text-mult-orange w-6 h-6" /> CADASTRAR <span className="text-neon-blue">USUÁRIO</span>
              </h2>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome Completo</label>
                    <input 
                      required
                      value={newUser.nome}
                      onChange={e => setNewUser({...newUser, nome: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">E-mail</label>
                    <input 
                      required
                      type="email"
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Senha Temporária</label>
                    <input 
                      required
                      type="password"
                      value={newUser.senha}
                      onChange={e => setNewUser({...newUser, senha: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cargo (Role)</label>
                    <select 
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    >
                      {profile.role === "master" && <option value="master" className="bg-cockpit-bg">Master</option>}
                      <option value="coordenador" className="bg-cockpit-bg">Coordenador</option>
                      <option value="professor" className="bg-cockpit-bg">Professor</option>
                      <option value="aluno" className="bg-cockpit-bg">Aluno</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Franquia / Unidade</label>
                  <select 
                    disabled={profile.role !== "master"}
                    value={newUser.franquiaId}
                    onChange={e => setNewUser({...newUser, franquiaId: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                  >
                    <option value="" className="bg-cockpit-bg">Selecione uma unidade</option>
                    {franquias.map(f => (
                      <option key={f.id} value={f.id} className="bg-cockpit-bg">{f.nome}</option>
                    ))}
                  </select>
                </div>

                {successMsg && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {successMsg}
                  </div>
                )}

                <button 
                  disabled={loading}
                  className="w-full bg-neon-blue text-black font-black py-4 rounded-xl transition-all neon-glow-blue disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "CRIAR USUÁRIO"}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddFranquia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-md p-8 space-y-6 relative"
            >
              <button onClick={() => setShowAddFranquia(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
              
              <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <Building2 className="text-mult-orange w-6 h-6" /> NOVA <span className="text-neon-blue">FRANQUIA</span>
              </h2>

              <form onSubmit={handleCreateFranquia} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ID Único (ex: rio-verde)</label>
                  <input 
                    required
                    value={newFranquia.id}
                    onChange={e => setNewFranquia({...newFranquia, id: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome da Unidade</label>
                  <input 
                    required
                    value={newFranquia.nome}
                    onChange={e => setNewFranquia({...newFranquia, nome: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cidade</label>
                  <input 
                    required
                    value={newFranquia.cidade}
                    onChange={e => setNewFranquia({...newFranquia, cidade: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                  />
                </div>

                {successMsg && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {successMsg}
                  </div>
                )}

                <button 
                  disabled={loading}
                  className="w-full bg-mult-orange text-white font-black py-4 rounded-xl transition-all neon-glow-orange disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "CRIAR FRANQUIA"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
