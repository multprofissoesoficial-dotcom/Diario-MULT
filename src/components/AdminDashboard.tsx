import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  onSnapshot,
  orderBy
} from "firebase/firestore";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { db, auth } from "../firebase";
import firebaseConfig from "../../firebase-applet-config.json";
import { UserProfile, Franquia, Mission } from "../types";
import { ROLES_LABELS, RANKS } from "../constants";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
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
  Rocket,
  Upload,
  AlertCircle,
  Trash2
} from "lucide-react";

export default function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [franquias, setFranquias] = useState<Franquia[]>([]);
  const [selectedFranquia, setSelectedFranquia] = useState<string>(profile.franquiaId || "all");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [showEditUser, setShowEditUser] = useState<UserProfile | null>(null);
  const [showAddFranquia, setShowAddFranquia] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(50);
  
  // Form states
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    codigo: "",
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
    // Listen to Users
    let q = query(collection(db, "users"));
    
    if (profile.role !== "master") {
      // Coordinator only sees their unit
      q = query(collection(db, "users"), where("franquiaId", "==", profile.franquiaId));
    } else if (selectedFranquia !== "all") {
      // Master filtering by unit
      q = query(collection(db, "users"), where("franquiaId", "==", selectedFranquia));
    }

    const unsubUsers = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile));
      setCurrentPage(1); // Reset to first page on filter change
    });

    return () => unsubUsers();
  }, [selectedFranquia, profile.franquiaId, profile.role]);

  const totalAlunos = users.filter(u => u.role === "aluno").length;
  const totalProfessores = users.filter(u => u.role === "professor").length;
  const totalCoordenadores = users.filter(u => u.role === "coordenador").length;

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.codigo && u.codigo.includes(searchQuery))
  );

  // Pagination logic
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const handleClearAllStudents = async () => {
    setLoading(true);
    try {
      // 1. Get all students
      const studentsQuery = query(collection(db, "users"), where("role", "==", "aluno"));
      const studentsSnap = await getDocs(studentsQuery);
      
      // 2. Get all missions (to be safe, we'll clear all missions since they belong to students)
      const missionsSnap = await getDocs(collection(db, "missions"));

      const totalToDelete = studentsSnap.size + missionsSnap.size;
      let deletedCount = 0;
      setImportProgress({ current: 0, total: totalToDelete });

      // Delete students
      for (const studentDoc of studentsSnap.docs) {
        await deleteDoc(doc(db, "users", studentDoc.id));
        deletedCount++;
        setImportProgress(prev => ({ ...prev, current: deletedCount }));
      }

      // Delete missions
      for (const missionDoc of missionsSnap.docs) {
        await deleteDoc(doc(db, "missions", missionDoc.id));
        deletedCount++;
        setImportProgress(prev => ({ ...prev, current: deletedCount }));
      }

      setSuccessMsg("Todos os alunos e missões foram removidos com sucesso!");
      setTimeout(() => {
        setShowClearConfirm(false);
        setSuccessMsg("");
        setImportProgress({ current: 0, total: 0 });
      }, 3000);
    } catch (err: any) {
      alert("Erro ao remover alunos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportStudents = async () => {
    if (!importText.trim()) return;
    setLoading(true);
    setSuccessMsg("");
    
    const results = Papa.parse(importText, { header: true, skipEmptyLines: true });
    const rows = results.data as any[];
    setImportProgress({ current: 0, total: rows.length });

    try {
      // Create ONE secondary app instance for the entire import process
      const secondaryAppName = `import-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nome = row["Nome Completo"] || row["nome"];
        const codigo = row["Código"] || row["codigo"] || row["Matrícula"] || row["matricula"];
        const email = row["Email"] || row["email"] || (codigo ? `${codigo}@mult.com.br` : "");
        const senha = row["Senha Temporária"] || row["senha"] || "nome123";
        const unidadeId = row["Unidade"] || row["unidade"];

        if (!nome || !email || !unidadeId) continue;

        // Check if user already exists in Firestore by email
        const existingQuery = query(collection(db, "users"), where("email", "==", email));
        const existingSnap = await getDocs(existingQuery);
        if (!existingSnap.empty) {
          console.log(`Usuário ${email} já existe, pulando...`);
          setImportProgress(prev => ({ ...prev, current: i + 1 }));
          continue;
        }

        try {
          // Add a small delay to avoid Firebase Auth rate limits (too-many-requests)
          await new Promise(resolve => setTimeout(resolve, 600));

          let userCred;
          try {
            userCred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
          } catch (authErr: any) {
            if (authErr.code === "auth/too-many-requests") {
              console.log("Muitas requisições, aguardando 5 segundos para tentar novamente...");
              await new Promise(resolve => setTimeout(resolve, 5000));
              userCred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
            } else {
              throw authErr;
            }
          }
          
          await setDoc(doc(db, "users", userCred.user.uid), {
            uid: userCred.user.uid,
            displayName: nome,
            email: email,
            codigo: codigo || "",
            role: "aluno",
            franquiaId: unidadeId,
            xp: 0,
            unlockedBadges: [],
            createdAt: new Date().toISOString()
          });

          // Sign out the secondary user immediately to allow the next creation
          await signOut(secondaryAuth);
          
          setImportProgress(prev => ({ ...prev, current: i + 1 }));
        } catch (err: any) {
          if (err.code === "auth/email-already-in-use") {
            console.log(`Email ${email} já está em uso no Auth. Se o usuário não estiver no banco, você precisará removê-lo manualmente no console do Firebase.`);
          } else {
            console.error(`Erro ao importar ${email}:`, err.message);
          }
          setImportProgress(prev => ({ ...prev, current: i + 1 }));
        }
      }

      // Cleanup the secondary app after all imports are done
      await deleteApp(secondaryApp);

      setSuccessMsg(`${rows.length} alunos processados! Se houveram erros, verifique o console.`);
      setImportText("");
      setTimeout(() => {
        setShowImportModal(false);
        setImportProgress({ current: 0, total: 0 });
      }, 3000);
    } catch (err: any) {
      console.error("Erro na importação:", err);
      alert("Erro na importação: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");

    try {
      // Create a secondary app instance to create the user without signing out the admin
      const secondaryAppName = "secondary-" + Date.now();
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const finalEmail = newUser.role === "aluno" && newUser.codigo 
        ? `${newUser.codigo}@mult.com.br` 
        : newUser.email;

      const userCred = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, newUser.senha);
      
      await setDoc(doc(db, "users", userCred.user.uid), {
        uid: userCred.user.uid,
        displayName: newUser.nome,
        email: finalEmail,
        codigo: newUser.codigo,
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

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;
    
    try {
      await deleteDoc(doc(db, "users", userId));
      setSuccessMsg("Usuário excluído com sucesso!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert("Erro ao excluir usuário: " + err.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditUser) return;
    setLoading(true);

    try {
      await setDoc(doc(db, "users", showEditUser.uid), showEditUser, { merge: true });
      setSuccessMsg("Usuário atualizado com sucesso!");
      setTimeout(() => {
        setShowEditUser(null);
        setSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      alert("Erro ao atualizar usuário: " + err.message);
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
        <div className="flex items-center justify-between w-full md:w-auto">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-mult-orange/20 rounded-xl flex items-center justify-center neon-glow-orange border border-mult-orange/30">
                <Rocket className="text-mult-orange w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none">
                MULT <span className="text-mult-orange">PROFISSÕES</span>
              </h1>
            </div>
            <p className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-2 ml-1">
              {profile.role === "master" ? "Gestão Global Master" : `Unidade: ${franquias.find(f => f.id === profile.franquiaId)?.nome || "Carregando..."}`}
            </p>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="md:hidden p-3 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 transition-all text-gray-500 border border-white/5"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <button 
            onClick={() => auth.signOut()}
            className="p-3 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 transition-all text-gray-500 border border-white/5"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Stats & Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-4 glass-card p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full md:w-auto">
            <div className="flex items-center gap-3 shrink-0">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar Unidade</span>
            </div>
            <select 
              disabled={profile.role !== "master"}
              value={selectedFranquia}
              onChange={(e) => setSelectedFranquia(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-neon-blue transition-all w-full sm:w-auto min-w-[200px]"
            >
              {profile.role === "master" && <option value="all" className="bg-cockpit-bg">Todas as Unidades</option>}
              {franquias.map(f => (
                <option key={f.id} value={f.id} className="bg-cockpit-bg">{f.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full md:w-auto">
            {profile.role === "master" && (
              <button 
                onClick={() => setShowAddFranquia(true)}
                className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 px-4 sm:px-6 rounded-xl transition-all text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" /> <span className="hidden sm:inline">Nova</span> Franquia
              </button>
            )}
            <button 
              onClick={() => setShowAddUser(true)}
              className="flex-1 sm:flex-none bg-mult-orange hover:bg-mult-orange/90 text-white font-bold py-3 px-4 sm:px-6 rounded-xl transition-all text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2 neon-glow-orange"
            >
              <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Novo</span> Usuário
            </button>
            {profile.role === "master" && (
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold py-3 px-4 sm:px-6 rounded-xl transition-all text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Limpar <span className="hidden sm:inline">Alunos</span>
              </button>
            )}
            {profile.role === "master" && (
              <button 
                onClick={() => setShowImportModal(true)}
                className="flex-1 sm:flex-none bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue border border-neon-blue/30 font-bold py-3 px-4 sm:px-6 rounded-xl transition-all text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Importar <span className="hidden sm:inline">Alunos</span>
              </button>
            )}
          </div>
        </div>

        <div className="glass-card p-5 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue neon-glow-blue border border-neon-blue/20">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Alunos</p>
            <p className="text-xl sm:text-2xl font-black">{totalAlunos}</p>
          </div>
        </div>

        <div className="glass-card p-5 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange border border-mult-orange/20">
            <Rocket className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Professores</p>
            <p className="text-xl sm:text-2xl font-black">{totalProfessores}</p>
          </div>
        </div>

        <div className="glass-card p-5 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 neon-glow-purple border border-purple-500/20">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Coordenadores</p>
            <p className="text-xl sm:text-2xl font-black">{totalCoordenadores}</p>
          </div>
        </div>

        <div className="glass-card p-5 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Geral</p>
            <p className="text-xl sm:text-2xl font-black">{users.length}</p>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Relatório de Desempenho</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="Buscar por nome, e-mail ou código..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-neon-blue transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                <th className="px-4 sm:px-6 py-4">Usuário</th>
                <th className="px-4 sm:px-6 py-4">Cargo</th>
                <th className="px-4 sm:px-6 py-4">Unidade</th>
                <th className="px-4 sm:px-6 py-4">Nível / XP</th>
                <th className="px-4 sm:px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {currentUsers.map((userItem) => {
                const rank = RANKS.reduce((prev, curr) => (userItem.xp >= curr.minXP ? curr : prev), RANKS[0]);
                return (
                  <tr key={userItem.uid} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-neon-blue transition-colors shrink-0">
                          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm truncate">{userItem.displayName}</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-600 font-mono truncate">{userItem.email || userItem.codigo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 shrink-0">
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded border border-white/10">
                        {ROLES_LABELS[userItem.role]}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 shrink-0">
                      <span className="text-[10px] sm:text-xs font-bold text-gray-400">
                        {franquias.find(f => f.id === userItem.franquiaId)?.nome || "Global"}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 shrink-0">
                      <div className="space-y-1">
                        <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${rank.color}`}>{rank.name}</p>
                        <p className="text-[10px] sm:text-xs font-bold text-gray-500">{userItem.xp} XP</p>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right shrink-0">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setShowEditUser(userItem)}
                          className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-neon-blue/20 hover:text-neon-blue transition-all text-gray-600"
                        >
                          <FileText className="w-3.5 h-3.5 sm:w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(userItem.uid)}
                          className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-all text-gray-600"
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-4 h-4 rotate-45" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {currentUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-600 italic">
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 bg-white/5 flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Página {currentPage} de {totalPages} ({filteredUsers.length} usuários)
            </p>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-[10px] font-black uppercase tracking-widest"
              >
                Anterior
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-[10px] font-black uppercase tracking-widest"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-2xl p-8 space-y-6 relative"
            >
              <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                  <Upload className="text-mult-orange w-6 h-6" /> IMPORTAR <span className="text-neon-blue">ALUNOS</span>
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                  Cole os dados abaixo no formato CSV (com cabeçalho)
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-black text-mult-orange uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" /> Formato Esperado:
                </p>
                <code className="text-[10px] text-gray-400 block bg-black/40 p-2 rounded font-mono">
                  Nome Completo,Código,Senha Temporária,Unidade<br/>
                  João Silva,12345,nome123,rio-verde<br/>
                  Maria Souza,67890,nome123,goiania
                </code>
              </div>

              <textarea 
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="Cole aqui o conteúdo do seu CSV..."
                className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-neon-blue transition-all"
              />

              {loading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <span>Processando Alunos (Aguarde o delay de segurança)...</span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-mult-orange neon-glow-orange"
                      initial={{ width: 0 }}
                      animate={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {successMsg}
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-widest text-xs"
                >
                  CANCELAR
                </button>
                <button 
                  disabled={loading || !importText.trim()}
                  onClick={handleImportStudents}
                  className="flex-1 bg-neon-blue text-black font-black py-4 rounded-xl transition-all neon-glow-blue disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "INICIAR IMPORTAÇÃO"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-md p-8 space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
              <div className="flex items-center gap-4 text-red-500">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Atenção!</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Ação Irreversível</p>
                </div>
              </div>

              <p className="text-sm text-gray-400 leading-relaxed">
                Você está prestes a remover <span className="text-white font-bold">TODOS OS ALUNOS</span> e suas respectivas missões do banco de dados. Esta ação não pode ser desfeita.
              </p>

              {loading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <span>Removendo registros...</span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {successMsg}
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  disabled={loading}
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-all uppercase tracking-widest text-xs"
                >
                  CANCELAR
                </button>
                <button 
                  disabled={loading}
                  onClick={handleClearAllStudents}
                  className="flex-1 bg-red-500 text-white font-black py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "REMOVER TUDO"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

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
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      {newUser.role === "aluno" ? "Código de Matrícula" : "E-mail"}
                    </label>
                    <input 
                      required
                      type={newUser.role === "aluno" ? "text" : "email"}
                      value={newUser.role === "aluno" ? newUser.codigo : newUser.email}
                      onChange={e => newUser.role === "aluno" 
                        ? setNewUser({...newUser, codigo: e.target.value}) 
                        : setNewUser({...newUser, email: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                      placeholder={newUser.role === "aluno" ? "Ex: 12345" : "seu@email.com"}
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

        {showEditUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-lg p-8 space-y-6 relative"
            >
              <button onClick={() => setShowEditUser(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
              
              <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <FileText className="text-mult-orange w-6 h-6" /> EDITAR <span className="text-neon-blue">USUÁRIO</span>
              </h2>

              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome Completo</label>
                    <input 
                      required
                      value={showEditUser.displayName}
                      onChange={e => setShowEditUser({...showEditUser, displayName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cargo (Role)</label>
                    <select 
                      value={showEditUser.role}
                      onChange={e => setShowEditUser({...showEditUser, role: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    >
                      {profile.role === "master" && <option value="master" className="bg-cockpit-bg">Master</option>}
                      <option value="coordenador" className="bg-cockpit-bg">Coordenador</option>
                      <option value="professor" className="bg-cockpit-bg">Professor</option>
                      <option value="aluno" className="bg-cockpit-bg">Aluno</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">XP Atual</label>
                    <input 
                      type="number"
                      value={showEditUser.xp}
                      onChange={e => setShowEditUser({...showEditUser, xp: Number(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Franquia / Unidade</label>
                    <select 
                      disabled={profile.role !== "master"}
                      value={showEditUser.franquiaId}
                      onChange={e => setShowEditUser({...showEditUser, franquiaId: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    >
                      <option value="" className="bg-cockpit-bg">Selecione uma unidade</option>
                      {franquias.map(f => (
                        <option key={f.id} value={f.id} className="bg-cockpit-bg">{f.nome}</option>
                      ))}
                    </select>
                  </div>
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "SALVAR ALTERAÇÕES"}
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
