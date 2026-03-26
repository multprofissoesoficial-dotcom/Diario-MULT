"use client";

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
  orderBy,
  limit,
  startAfter
} from "firebase/firestore";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut 
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { db, auth } from "../firebase";
import { handleFirestoreError, OperationType, cn } from "../lib/utils";
import firebaseConfig from "../../firebase-applet-config.json";
import { UserProfile, Franquia, Mission } from "../types";
import MissionHistoryModal from "./MissionHistoryModal";
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
  Trash2,
  Clock,
  Eye,
  Lock as LockIcon
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
  const [showMissionHistory, setShowMissionHistory] = useState<UserProfile | null>(null);
  const [showAddFranquia, setShowAddFranquia] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(50);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [turmaFilter, setTurmaFilter] = useState<string>("all");
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [pendingMissions, setPendingMissions] = useState<Mission[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "activities">("users");
  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [lastMissionDoc, setLastMissionDoc] = useState<any>(null);
  const [hasMoreMissions, setHasMoreMissions] = useState(true);
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatusFilter, setActivityStatusFilter] = useState<string>("all");
  
  // Form states
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    codigo: "",
    senha: "",
    role: "aluno" as any,
    franquiaId: profile.franquiaId || "",
    turma: ""
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
    // Initial fetch of users
    fetchUsers(true);
  }, [selectedFranquia, profile.franquiaId, profile.role, roleFilter, turmaFilter, searchQuery]);

  const fetchUsers = async (reset = false) => {
    setLoading(true);
    try {
      let q = query(collection(db, "users"), orderBy("displayName"), limit(usersPerPage));
      
      if (profile.role !== "master") {
        q = query(q, where("franquiaId", "==", profile.franquiaId));
      } else if (selectedFranquia !== "all") {
        q = query(q, where("franquiaId", "==", selectedFranquia));
      }

      if (roleFilter !== "all") {
        q = query(q, where("role", "==", roleFilter));
      }

      if (turmaFilter !== "all") {
        q = query(q, where("turma", "==", turmaFilter));
      }

      // Note: Search with where is limited in Firestore. 
      // For now we'll keep the client-side filtering for search or implement a better search later.
      // But we'll limit the initial fetch.

      if (!reset && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);
      const newUsers = snap.docs.map(d => d.data() as UserProfile);
      
      if (reset) {
        setUsers(newUsers);
      } else {
        setUsers(prev => [...prev, ...newUsers]);
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === usersPerPage);
    } catch (err: any) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreUsers = () => {
    if (!loading && hasMore) {
      fetchUsers();
    }
  };

  useEffect(() => {
    // Listen to Pending Missions
    let q = query(collection(db, "missions"), where("status", "==", "pending"));
    
    if (profile.role !== "master") {
      q = query(collection(db, "missions"), where("status", "==", "pending"), where("franquiaId", "==", profile.franquiaId));
    } else if (selectedFranquia !== "all") {
      q = query(collection(db, "missions"), where("status", "==", "pending"), where("franquiaId", "==", selectedFranquia));
    }

    const unsubMissions = onSnapshot(q, (snap) => {
      setPendingMissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission)));
    });

    return () => unsubMissions();
  }, [selectedFranquia, profile.franquiaId, profile.role]);

  useEffect(() => {
    fetchMissions(true);
  }, [selectedFranquia, profile.franquiaId, profile.role, activityStatusFilter, activitySearch, dateFilter]);

  const fetchMissions = async (reset = false) => {
    setLoading(true);
    try {
      let q = query(collection(db, "missions"), orderBy("createdAt", "desc"), limit(usersPerPage));
      
      if (profile.role !== "master") {
        q = query(q, where("franquiaId", "==", profile.franquiaId));
      } else if (selectedFranquia !== "all") {
        q = query(q, where("franquiaId", "==", selectedFranquia));
      }

      if (activityStatusFilter !== "all") {
        q = query(q, where("status", "==", activityStatusFilter));
      }

      // Date filtering in Firestore is complex with multiple where clauses.
      // For now, we'll keep client-side filtering for dates and search if needed,
      // but we limit the fetch.

      if (!reset && lastMissionDoc) {
        q = query(q, startAfter(lastMissionDoc));
      }

      const snap = await getDocs(q);
      const newMissions = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission));
      
      if (reset) {
        setAllMissions(newMissions);
      } else {
        setAllMissions(prev => [...prev, ...newMissions]);
      }

      setLastMissionDoc(snap.docs[snap.docs.length - 1]);
      setHasMoreMissions(snap.docs.length === usersPerPage);
    } catch (err: any) {
      console.error("Error fetching missions:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMissions = () => {
    if (!loading && hasMoreMissions) {
      fetchMissions();
    }
  };

  const totalAlunos = users.filter(u => u.role === "aluno").length;
  const totalProfessores = users.filter(u => u.role === "professor").length;
  const totalCoordenadores = users.filter(u => u.role === "coordenador").length;
  const avgXP = totalAlunos > 0 ? Math.round(users.filter(u => u.role === "aluno").reduce((acc, curr) => acc + (curr.xp || 0), 0) / totalAlunos) : 0;

  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`Deseja enviar um e-mail de redefinição de senha para ${email}?`)) return;
    
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, email);
      alert("E-mail de redefinição enviado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao enviar reset:", error);
      alert("Erro ao enviar e-mail: " + error.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.codigo && u.codigo.includes(searchQuery));
    
    const matchesPending = !pendingOnly || pendingMissions.some(m => m.studentId === u.uid);
    
    return matchesSearch && matchesPending;
  });

  const filteredMissions = allMissions.filter(m => {
    const matchesSearch = m.studentName.toLowerCase().includes(activitySearch.toLowerCase()) ||
      m.module.toLowerCase().includes(activitySearch.toLowerCase()) ||
      m.content.toLowerCase().includes(activitySearch.toLowerCase());
    
    const matchesStatus = activityStatusFilter === "all" || m.status === activityStatusFilter;
    
    const missionDate = m.createdAt ? new Date(m.createdAt) : null;
    const matchesDate = (!dateFilter.start || (missionDate && missionDate >= new Date(dateFilter.start))) &&
      (!dateFilter.end || (missionDate && missionDate <= new Date(dateFilter.end + "T23:59:59")));
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Pagination logic removed in favor of Load More
  const currentUsers = filteredUsers;
  const totalPages = 1; // Not used anymore

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

  const [importPreview, setImportPreview] = useState<any[]>([]);

  const handlePreviewImport = () => {
    if (!importText.trim()) return;
    const results = Papa.parse(importText, { 
      header: true, 
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      delimitersToGuess: [',', ';', '\t', '|']
    });
    setImportPreview(results.data as any[]);
  };

  const handleImportStudents = async () => {
    if (!importText.trim()) return;
    setLoading(true);
    setSuccessMsg("");
    
    const results = Papa.parse(importText, { 
      header: true, 
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      delimitersToGuess: [',', ';', '\t', '|']
    });
    
    const rows = results.data as any[];
    
    if (rows.length === 0) {
      alert("Nenhum dado válido detectado. Verifique se o cabeçalho está correto.");
      setLoading(false);
      return;
    }

    const studentsToImport = rows.map(row => {
      const nome = row["Nome Completo"] || row["nome"];
      const codigo = row["Código"] || row["codigo"] || row["Matrícula"] || row["matricula"];
      const email = row["Email"] || row["email"];
      const senha = row["Senha Temporária"] || row["senha"] || (codigo ? String(codigo) : "nome123");
      const unidadeInput = row["Unidade"] || row["unidade"];
      const turma = row["Turma"] || row["turma"];

      let finalUnidadeId = unidadeInput;
      const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, " ").trim();
      const normalizedInput = normalize(unidadeInput || "");
      
      const foundFranquia = franquias.find(f => 
        f.id === unidadeInput || 
        normalize(f.nome) === normalizedInput ||
        normalize(f.cidade) === normalizedInput
      );
      
      if (foundFranquia) {
        finalUnidadeId = foundFranquia.id;
      }

      return {
        nome,
        codigo,
        email,
        senha,
        franquiaId: finalUnidadeId,
        turma
      };
    });

    try {
      const response = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: studentsToImport }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao importar alunos");
      }

      const importResult = await response.json();
      setSuccessMsg(`${importResult.success} alunos importados, ${importResult.skipped} pulados, ${importResult.errors} erros.`);
      setImportText("");
      setImportPreview([]);
      setTimeout(() => {
        setShowImportModal(false);
        setSuccessMsg("");
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
    
    if (!newUser.nome || !newUser.senha) {
      alert("Nome e Senha são obrigatórios.");
      return;
    }

    if (newUser.role !== "master" && !newUser.franquiaId) {
      alert("Selecione uma unidade para este usuário.");
      return;
    }

    setLoading(true);
    setSuccessMsg("");

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

      setSuccessMsg("Usuário criado com sucesso!");
      setNewUser({ 
        nome: "", 
        email: "", 
        codigo: "", 
        senha: "", 
        role: "aluno", 
        franquiaId: profile.franquiaId || "",
        turma: ""
      });
      setTimeout(() => setShowAddUser(false), 2000);
    } catch (err: any) {
      console.error("Erro ao criar usuário:", err);
      alert("Erro ao criar usuário: " + (err.message || "Erro desconhecido"));
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
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
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
      handleFirestoreError(err, OperationType.WRITE, `users/${showEditUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => {
    const filteredMissions = allMissions.filter(m => {
      const matchesSearch = m.studentName.toLowerCase().includes(activitySearch.toLowerCase()) ||
        m.module.toLowerCase().includes(activitySearch.toLowerCase()) ||
        m.content.toLowerCase().includes(activitySearch.toLowerCase());
      
      const matchesStatus = activityStatusFilter === "all" || m.status === activityStatusFilter;
      
      const missionDate = m.createdAt ? new Date(m.createdAt) : null;
      const matchesDate = (!dateFilter.start || (missionDate && missionDate >= new Date(dateFilter.start))) &&
        (!dateFilter.end || (missionDate && missionDate <= new Date(dateFilter.end + "T23:59:59")));
      
      return matchesSearch && matchesStatus && matchesDate;
    });

    const csvData = filteredMissions.map(m => ({
      "Aluno": m.studentName,
      "Atividade": `${m.module} - Aula ${m.classNum}`,
      "Data": m.createdAt ? new Date(m.createdAt).toLocaleDateString("pt-BR") : "N/A",
      "Status": m.status === "approved" ? "Aprovado" : m.status === "pending" ? "Pendente" : m.status === "bonus" ? "Bônus" : "Rejeitado",
      "XP": m.xpAwarded || 0,
      "Unidade": franquias.find(f => f.id === m.franquiaId)?.nome || "N/A"
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_atividades_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
        <button
          onClick={() => setActiveTab("users")}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === "users" ? "bg-neon-blue text-black neon-glow-blue" : "text-gray-500 hover:text-white"
          )}
        >
          <Users className="w-4 h-4" /> Gestão de Usuários
        </button>
        <button
          onClick={() => setActiveTab("activities")}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === "activities" ? "bg-mult-orange text-white neon-glow-orange" : "text-gray-500 hover:text-white"
          )}
        >
          <FileText className="w-4 h-4" /> Atividades dos Alunos
        </button>
      </div>

      {/* Stats & Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-5 glass-card p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
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

        <button 
          onClick={() => {
            setActiveTab("users");
            setRoleFilter("aluno");
            setPendingOnly(false);
            setCurrentPage(1);
          }}
          className={cn(
            "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98] text-left",
            roleFilter === "aluno" && !pendingOnly ? "border-neon-blue bg-neon-blue/10" : "hover:bg-white/5"
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue neon-glow-blue border border-neon-blue/20">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Alunos</p>
            <p className="text-xl sm:text-2xl font-black">{totalAlunos}</p>
          </div>
        </button>

        <button 
          onClick={() => {
            setActiveTab("users");
            setRoleFilter("professor");
            setPendingOnly(false);
            setCurrentPage(1);
          }}
          className={cn(
            "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98] text-left",
            roleFilter === "professor" && !pendingOnly ? "border-mult-orange bg-mult-orange/10" : "hover:bg-white/5"
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange border border-mult-orange/20">
            <Rocket className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Professores</p>
            <p className="text-xl sm:text-2xl font-black">{totalProfessores}</p>
          </div>
        </button>

        <button 
          onClick={() => {
            setActiveTab("users");
            setRoleFilter("coordenador");
            setPendingOnly(false);
            setCurrentPage(1);
          }}
          className={cn(
            "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98] text-left",
            roleFilter === "coordenador" && !pendingOnly ? "border-purple-500 bg-purple-500/10" : "hover:bg-white/5"
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 neon-glow-purple border border-purple-500/20">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Coordenadores</p>
            <p className="text-xl sm:text-2xl font-black">{totalCoordenadores}</p>
          </div>
        </button>

        <button 
          onClick={() => {
            setActiveTab("users");
            setRoleFilter("all");
            setPendingOnly(true);
            setCurrentPage(1);
          }}
          className={cn(
            "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98] text-left",
            pendingOnly ? "border-yellow-500 bg-yellow-500/10" : "hover:bg-white/5"
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 neon-glow-yellow border border-yellow-500/20">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pendentes</p>
            <p className="text-xl sm:text-2xl font-black">{pendingMissions.length}</p>
          </div>
        </button>

        <button 
          onClick={() => {
            setActiveTab("users");
            setRoleFilter("all");
            setPendingOnly(false);
            setCurrentPage(1);
          }}
          className={cn(
            "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98] text-left",
            roleFilter === "all" && !pendingOnly ? "border-white bg-white/5" : "hover:bg-white/5"
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Geral</p>
            <p className="text-xl sm:text-2xl font-black">{users.length}</p>
          </div>
        </button>

        {/* Extra Indicator for Coordinators/Masters */}
        <div className="glass-card p-5 sm:p-6 flex items-center gap-4 bg-neon-blue/5 border-neon-blue/20">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue border border-neon-blue/20">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Média XP / Aluno</p>
            <p className="text-xl sm:text-2xl font-black text-neon-blue">{avgXP}</p>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "users" ? (
        <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              Relatório de Desempenho
            </h3>
            <div className="flex gap-2">
              <select 
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setTurmaFilter("all"); }}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-neon-blue transition-all"
              >
                <option value="all">Todos os Cargos</option>
                <option value="aluno">Alunos</option>
                <option value="professor">Professores</option>
                <option value="coordenador">Coordenadores</option>
              </select>
              {roleFilter === "aluno" && (
                <select 
                  value={turmaFilter}
                  onChange={(e) => setTurmaFilter(e.target.value)}
                  className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-neon-blue transition-all"
                >
                  <option value="all">Todas as Turmas</option>
                  {Array.from(new Set(users.filter(u => u.turma).map(u => u.turma))).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
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
                const hasPending = pendingMissions.some(m => m.studentId === userItem.uid);
                return (
                  <tr key={userItem.uid} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-neon-blue transition-colors shrink-0">
                            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          {hasPending && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-cockpit-bg animate-pulse" title="Atividades Pendentes" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-xs sm:text-sm truncate">{userItem.displayName}</p>
                            {hasPending && (
                              <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 text-[8px] font-black uppercase tracking-tighter border border-yellow-500/20">
                                Pendente
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-[9px] sm:text-[10px] text-gray-400 font-mono truncate">{userItem.email}</p>
                            {userItem.codigo && (
                              <p className="text-[8px] sm:text-[9px] text-mult-orange font-black uppercase tracking-widest">MAT: {userItem.codigo}</p>
                            )}
                          </div>
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
                        {userItem.role === "aluno" && (
                          <button 
                            onClick={() => setShowMissionHistory(userItem)}
                            className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-neon-blue/20 hover:text-neon-blue transition-all text-gray-600"
                            title="Ver Histórico de Missões"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleResetPassword(userItem.email)}
                          className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-mult-orange/20 hover:text-mult-orange transition-all text-gray-600"
                          title="Redefinir Senha"
                        >
                          <LockIcon className="w-3.5 h-3.5 sm:w-4 h-4" />
                        </button>
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

        {/* Load More */}
        {hasMore && (
          <div className="p-6 border-t border-white/5 bg-white/5 flex justify-center">
            <button 
              onClick={loadMoreUsers}
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-neon-blue text-black font-black uppercase tracking-widest text-xs neon-glow-blue disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Carregar Mais Usuários"}
            </button>
          </div>
        )}
      </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/5 space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Navegação de Atividades</h3>
              <button 
                onClick={handleGenerateReport}
                className="bg-neon-blue text-black font-black py-2.5 px-6 rounded-xl transition-all neon-glow-blue text-[10px] uppercase tracking-widest flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Gerar Relatório CSV
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Palavra-chave</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="text"
                    placeholder="Buscar aluno ou atividade..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-neon-blue transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</label>
                <select 
                  value={activityStatusFilter}
                  onChange={(e) => setActivityStatusFilter(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-neon-blue transition-all"
                >
                  <option value="all" className="bg-cockpit-bg">Todos os Status</option>
                  <option value="pending" className="bg-cockpit-bg">Pendente</option>
                  <option value="approved" className="bg-cockpit-bg">Aprovado</option>
                  <option value="bonus" className="bg-cockpit-bg">Bônus</option>
                  <option value="rejected" className="bg-cockpit-bg">Rejeitado</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Data Início</label>
                <input 
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-neon-blue transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Data Fim</label>
                <input 
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-neon-blue transition-all"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                  <th className="px-6 py-4">Aluno</th>
                  <th className="px-6 py-4">Atividade</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">XP</th>
                  <th className="px-6 py-4">Unidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMissions.map((mission) => (
                  <tr key={mission.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-xs sm:text-sm">{mission.studentName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-medium text-gray-300">{mission.module} - Aula {mission.classNum}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-mono text-gray-500">
                        {mission.createdAt ? new Date(mission.createdAt).toLocaleDateString("pt-BR") : "N/A"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border",
                        mission.status === "approved" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        mission.status === "pending" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                        mission.status === "bonus" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                        "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        {mission.status === "approved" ? "Aprovado" : 
                         mission.status === "pending" ? "Pendente" : 
                         mission.status === "bonus" ? "Bônus" : "Rejeitado"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-neon-blue">+{mission.xpAwarded || 0} XP</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {franquias.find(f => f.id === mission.franquiaId)?.nome || "N/A"}
                      </p>
                    </td>
                  </tr>
                ))}
                {filteredMissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-gray-600 italic">
                      Nenhuma atividade encontrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Load More Missions */}
          {hasMoreMissions && (
            <div className="p-6 border-t border-white/5 bg-white/5 flex justify-center">
              <button 
                onClick={loadMoreMissions}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-mult-orange text-white font-black uppercase tracking-widest text-xs neon-glow-orange disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Carregar Mais Atividades"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showMissionHistory && (
          <MissionHistoryModal 
            student={showMissionHistory} 
            onClose={() => setShowMissionHistory(null)} 
          />
        )}
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
                  <AlertCircle className="w-3 h-3" /> Formato Recomendado (Ponto e Vírgula):
                </p>
                <code className="text-[10px] text-gray-400 block bg-black/40 p-2 rounded font-mono">
                  Nome Completo;Código;Unidade;Senha Temporária<br/>
                  João Silva;12345;unidade-01;senha123<br/>
                  Maria Souza;67890;unidade-01;senha456
                </code>
              </div>

              <div className="space-y-4">
                <textarea 
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setImportPreview([]); }}
                  placeholder="Cole aqui o conteúdo do seu CSV ou Excel..."
                  className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-neon-blue transition-all"
                />
                
                <button 
                  onClick={handlePreviewImport}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/10 transition-all"
                >
                  VERIFICAR DADOS
                </button>
              </div>

              {importPreview.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-white/10 rounded-xl bg-black/20">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-white/5 sticky top-0">
                      <tr>
                        <th className="p-2 border-b border-white/10">Nome</th>
                        <th className="p-2 border-b border-white/10">Código</th>
                        <th className="p-2 border-b border-white/10">Unidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-b border-white/5">
                          <td className="p-2">{row["Nome Completo"] || row["nome"]}</td>
                          <td className="p-2">{row["Código"] || row["codigo"] || row["Matrícula"] || row["matricula"]}</td>
                          <td className="p-2">{row["Unidade"] || row["unidade"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 10 && (
                    <p className="p-2 text-center text-gray-500 italic">E mais {importPreview.length - 10} registros...</p>
                  )}
                </div>
              )}

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
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    required
                    value={newUser.nome}
                    onChange={e => setNewUser({...newUser, nome: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    placeholder="Nome do usuário"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">E-mail</label>
                    <div className="flex gap-2">
                      <input 
                        required={newUser.role !== "aluno"}
                        type="email"
                        value={newUser.email}
                        onChange={e => setNewUser({...newUser, email: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                        placeholder="seu@email.com"
                      />
                      {newUser.role === "aluno" && newUser.codigo && (
                        <button 
                          type="button"
                          onClick={() => setNewUser({...newUser, email: `${newUser.codigo}@mult.com.br`})}
                          className="px-3 bg-mult-orange/20 text-mult-orange rounded-lg border border-mult-orange/30 hover:bg-mult-orange/30 transition-all text-[10px] font-black uppercase"
                          title="Gerar E-mail MULT"
                        >
                          GERAR
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Matrícula / Código {newUser.role !== "aluno" && "(Opcional)"}
                    </label>
                    <input 
                      required={newUser.role === "aluno"}
                      value={newUser.codigo}
                      onChange={e => setNewUser({...newUser, codigo: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                      placeholder="Ex: 12345"
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
                      placeholder="Mínimo 6 caracteres"
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

                {newUser.role === "aluno" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Turma (ex: 024inf)</label>
                    <input 
                      value={newUser.turma}
                      onChange={e => setNewUser({...newUser, turma: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                      placeholder="Código da turma"
                    />
                  </div>
                )}

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
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    required
                    value={showEditUser.displayName}
                    onChange={e => setShowEditUser({...showEditUser, displayName: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">E-mail (Apenas Leitura)</label>
                    <input 
                      disabled
                      type="email"
                      value={showEditUser.email}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Matrícula / Código</label>
                    <input 
                      value={showEditUser.codigo || ""}
                      onChange={e => setShowEditUser({...showEditUser, codigo: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                    />
                  </div>
                  {showEditUser.role === "aluno" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Turma</label>
                      <input 
                        value={showEditUser.turma || ""}
                        onChange={e => setShowEditUser({...showEditUser, turma: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
