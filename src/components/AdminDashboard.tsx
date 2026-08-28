"use client";

import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { UserProfile, Franquia, Mission } from "../types";
import { getRelativeLesson } from "../utils/lessonMapper";
import MissionHistoryModal from "./MissionHistoryModal";
import { ROLES_LABELS, RANKS, XP_PER_MISSION, XP_BONUS } from "../constants";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import AtsDashboard from "./AtsDashboard";
import CourseManager from "./CourseManager";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { 
  Users, 
  Plus, 
  Building2, 
  Search, 
  Filter, 
  LogOut, 
  Trophy, 
  FileText, 
  UserPlus, 
  Loader2, 
  CheckCircle2, 
  Rocket, 
  Upload, 
  AlertCircle, 
  Trash2, 
  Clock, 
  Eye, 
  Lock as LockIcon, 
  Briefcase, 
  Target, 
  CheckCircle, 
  Zap, 
  XCircle, 
  Calendar, 
  BookOpen, 
  Settings, 
  Download,
  RefreshCw
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
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showEditUser, setShowEditUser] = useState<UserProfile | null>(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<UserProfile | null>(null);
  const [newPasswordForReset, setNewPasswordForReset] = useState("");
  const [showMissionHistory, setShowMissionHistory] = useState<UserProfile | null>(null);
  const [showAddFranquia, setShowAddFranquia] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [usersPerPage] = useState(50);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [turmaFilter, setTurmaFilter] = useState<string>("all");
  const [hasMore, setHasMore] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [pendingMissions, setPendingMissions] = useState<Mission[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("INF");
  const [activeTab, setActiveTab] = useState<"users" | "activities" | "ats" | "courses" | "maintenance">(
    profile.role === "rh" ? "ats" : "users"
  );
  
  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [missionsPage, setMissionsPage] = useState(0);
  const [hasMoreMissions, setHasMoreMissions] = useState(true);
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatusFilter, setActivityStatusFilter] = useState<string>("all");
  const [resolvedUsers, setResolvedUsers] = useState<Record<string, UserProfile>>({});

  const [backupLoading, setBackupLoading] = useState(false);
  const [importingToSupabase, setImportingToSupabase] = useState(false);
  const [supabaseImportReport, setSupabaseImportReport] = useState<any>(null);

  const [counts, setCounts] = useState({
    users: { total: 0, aluno: 0, professor: 0, coordenador: 0, rh: 0, pending: 0, active: 0 },
    missions: { total: 0, pending: 0, approved: 0, bonus: 0 },
    ats: { jobs: 0, applications: 0, companies: 0, hired: 0 }
  });

  const [selectedMissionForView, setSelectedMissionForView] = useState<Mission | null>(null);
  
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
  const [turmas, setTurmas] = useState<string[]>([]);

  useEffect(() => {
    const fetchBaseData = async () => {
      const { data: frs } = await supabase.from("franquias").select("*").order("nome");
      if (frs) setFranquias(frs);

      const { data: crs } = await supabase.from("cursos").select("*").order("title");
      if (crs) setCourses(crs);
    };
    fetchBaseData();
  }, []);

  useEffect(() => {
    const fetchTurmas = async () => {
      let query = supabase.from("usuarios").select("turma").not("turma", "is", null);
      if (profile.role !== "master") {
        query = query.eq("franquia_id", profile.franquiaId);
      } else if (selectedFranquia !== "all") {
        query = query.eq("franquia_id", selectedFranquia);
      }

      const { data } = await query;
      if (data) {
        const unique = Array.from(new Set(data.map(d => d.turma).filter(Boolean)));
        setTurmas(unique as string[]);
      }
    };
    fetchTurmas();
  }, [selectedFranquia, profile.franquiaId, profile.role]);

  useEffect(() => {
    fetchCounts();
  }, [selectedFranquia, profile.franquiaId, profile.role]);

  const fetchCounts = async () => {
    try {
      const getCount = async (table: string, applyFilter?: (q: any) => any) => {
        let q = supabase.from(table).select("*", { count: "exact", head: true });
        if (profile.role !== "master") {
          q = q.eq("franquia_id", profile.franquiaId);
        } else if (selectedFranquia !== "all") {
          q = q.eq("franquia_id", selectedFranquia);
        }
        if (applyFilter) q = applyFilter(q);
        const { count } = await q;
        return count || 0;
      };

      const [
        totalUsers, alunoCount, profCount, coordCount, rhCount, activeCount,
        totalMis, pendMis, appMis, bonMis,
        jobCount, appCount, compCount, hiredCount
      ] = await Promise.all([
        getCount("usuarios"),
        getCount("usuarios", q => q.eq("role", "aluno")),
        getCount("usuarios", q => q.eq("role", "professor")),
        getCount("usuarios", q => q.eq("role", "coordenador")),
        getCount("usuarios", q => q.eq("role", "rh")),
        getCount("usuarios", q => q.eq("role", "aluno").not("last_login", "is", null)),
        getCount("missoes"),
        getCount("missoes", q => q.eq("status", "pending")),
        getCount("missoes", q => q.eq("status", "approved")),
        getCount("missoes", q => q.eq("status", "bonus")),
        getCount("vagas", q => q.eq("status", "aberta")),
        getCount("candidaturas"),
        getCount("empresas"),
        getCount("candidaturas", q => q.eq("status", "contratado"))
      ]);

      setCounts({
        users: { total: totalUsers, aluno: alunoCount, professor: profCount, coordenador: coordCount, rh: rhCount, pending: pendMis, active: activeCount },
        missions: { total: totalMis, pending: pendMis, approved: appMis, bonus: bonMis },
        ats: { jobs: jobCount, applications: appCount, companies: compCount, hired: hiredCount }
      });
    } catch (err) {
      console.error("Erro ao buscar contadores:", err);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchUsers(true);
  }, [selectedFranquia, profile.franquiaId, profile.role, roleFilter, turmaFilter, searchQuery]);

  const fetchUsers = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      const from = currentPage * usersPerPage;
      const to = from + usersPerPage - 1;

      let q = supabase.from("usuarios").select("*").range(from, to).order("display_name", { ascending: true });

      if (profile.role !== "master") {
        q = q.eq("franquia_id", profile.franquiaId);
      } else if (selectedFranquia !== "all") {
        q = q.eq("franquia_id", selectedFranquia);
      }

      if (roleFilter !== "all") q = q.eq("role", roleFilter);
      if (turmaFilter !== "all") q = q.eq("turma", turmaFilter);

      if (searchQuery.trim()) {
        const isCode = /^\d+$/.test(searchQuery);
        if (isCode) {
          q = q.ilike("codigo", `%${searchQuery}%`);
        } else {
          q = q.or(`display_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
        }
      }

      const { data, error } = await q;
      if (error) throw error;

      const mappedUsers: UserProfile[] = (data || []).map((u: any) => ({
        id: u.id,
        uid: u.uid || u.id,
        email: u.email,
        displayName: u.display_name,
        codigo: u.codigo,
        role: u.role,
        franquiaId: u.franquia_id,
        turma: u.turma,
        xp: u.xp || 0,
        skills: u.skills || [],
        resumeUrl: u.resume_url,
        availabilityStatus: u.availability_status,
        withdrawalReason: u.withdrawal_reason,
        unlockedBadges: u.unlocked_badges || [],
        currentCourseId: u.current_course_id,
        atsTermsAccepted: u.ats_terms_accepted,
        atsTermsAcceptedAt: u.ats_terms_accepted_at,
        perceptions: u.perceptions,
        employmentHistory: u.employment_history,
        createdAt: u.created_at,
        lastLogin: u.last_login
      }));

      if (reset) {
        setUsers(mappedUsers);
        setPage(1);
      } else {
        setUsers(prev => [...prev, ...mappedUsers]);
        setPage(prev => prev + 1);
      }

      setHasMore(mappedUsers.length === usersPerPage);
    } catch (err: any) {
      console.error("Erro ao buscar usuários do Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMissionsPage(0);
    fetchMissions(true);
  }, [selectedFranquia, profile.franquiaId, profile.role, activityStatusFilter, activitySearch, dateFilter]);

  const fetchMissions = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 0 : missionsPage;
      const from = currentPage * usersPerPage;
      const to = from + usersPerPage - 1;

      let q = supabase.from("missoes").select("*").range(from, to).order("created_at", { ascending: false });

      if (profile.role !== "master") {
        q = q.eq("franquia_id", profile.franquiaId);
      } else if (selectedFranquia !== "all") {
        q = q.eq("franquia_id", selectedFranquia);
      }

      if (activityStatusFilter !== "all") q = q.eq("status", activityStatusFilter);
      if (dateFilter.start) q = q.gte("created_at", dateFilter.start);
      if (dateFilter.end) q = q.lte("created_at", `${dateFilter.end}T23:59:59`);
      if (activitySearch.trim()) q = q.or(`student_name.ilike.%${activitySearch}%,module.ilike.%${activitySearch}%,content.ilike.%${activitySearch}%`);

      const { data, error } = await q;
      if (error) throw error;

      const mappedMissions: Mission[] = (data || []).map((m: any) => ({
        id: m.id,
        studentId: m.student_id,
        studentName: m.student_name || "Aluno",
        franquiaId: m.franquia_id,
        turma: m.turma,
        courseId: m.course_id,
        courseName: m.course_name,
        module: m.module,
        classNum: m.class_num,
        content: m.content,
        status: m.status,
        aiFeedback: m.ai_feedback,
        xpAwarded: m.xp_awarded || 0,
        createdAt: m.created_at,
        approvedAt: m.approved_at,
        approvedBy: m.approved_by
      }));

      if (reset) {
        setAllMissions(mappedMissions);
        setMissionsPage(1);
      } else {
        setAllMissions(prev => [...prev, ...mappedMissions]);
        setMissionsPage(prev => prev + 1);
      }

      setHasMoreMissions(mappedMissions.length === usersPerPage);
    } catch (err) {
      console.error("Erro ao buscar missões do Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMission = async (mission: Mission, bonus: boolean) => {
    setLoading(true);
    const xp = bonus ? XP_BONUS : XP_PER_MISSION;

    try {
      await supabase.from("missoes").update({
        status: bonus ? "bonus" : "approved",
        xp_awarded: xp,
        approved_at: new Date().toISOString(),
        approved_by: profile.uid
      }).eq("id", mission.id);

      const { data: userCurrent } = await supabase.from("usuarios").select("xp").eq("id", mission.studentId).single();
      const currentXP = userCurrent?.xp || 0;
      await supabase.from("usuarios").update({ xp: currentXP + xp }).eq("id", mission.studentId);

      setAllMissions(prev => prev.map(m => m.id === mission.id ? { ...m, status: bonus ? "bonus" : "approved", xpAwarded: xp } : m));
      setSelectedMissionForView(null);
      fetchCounts();
      setSuccessMsg("Missão aprovada com sucesso!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert("Erro ao aprovar missão: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectMission = async (mission: Mission) => {
    setLoading(true);
    try {
      await supabase.from("missoes").update({
        status: "rejected",
        approved_by: profile.uid
      }).eq("id", mission.id);

      setAllMissions(prev => prev.map(m => m.id === mission.id ? { ...m, status: "rejected" } : m));
      setSelectedMissionForView(null);
      fetchCounts();
      setSuccessMsg("Missão rejeitada.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert("Erro ao rejeitar missão: " + err.message);
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
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar usuário");
      }

      setSuccessMsg("Usuário cadastrado com sucesso!");
      setNewUser({ 
        nome: "", 
        email: "", 
        codigo: "", 
        senha: "", 
        role: "aluno", 
        franquiaId: profile.franquiaId || "",
        turma: ""
      });
      fetchCounts();
      fetchUsers(true);
      setTimeout(() => {
        setShowAddUser(false);
        setSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      console.error("Erro ao criar usuário:", err);
      alert("Erro ao criar usuário: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

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
      
      if (foundFranquia) finalUnidadeId = foundFranquia.id;

      return { nome, codigo, email, senha, franquiaId: finalUnidadeId, turma };
    });

    setImportProgress({ current: 0, total: studentsToImport.length });

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/students/import", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          students: studentsToImport,
          courseId: selectedCourseId,
          courseName: courses.find(c => c.id === selectedCourseId)?.title || "Informática"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao importar alunos");
      }

      const importResult = await response.json();
      setSuccessMsg(`${importResult.success} alunos importados com sucesso!`);
      setImportText("");
      setImportPreview([]);
      fetchCounts();
      fetchUsers(true);
      setTimeout(() => {
        setShowImportModal(false);
        setSuccessMsg("");
      }, 3000);
    } catch (err: any) {
      alert("Erro na importação: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBackupToSupabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingToSupabase(true);
    setSupabaseImportReport(null);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      const res = await fetch("/api/maintenance/import-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro na importação");

      setSupabaseImportReport(result.report);
      setSuccessMsg("Dados carregados com sucesso no Supabase!");
      fetchCounts();
      fetchUsers(true);
      fetchMissions(true);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      console.error("Erro na importação para Supabase:", err);
      alert("Erro na importação: " + (err.message || "Erro desconhecido"));
    } finally {
      setImportingToSupabase(false);
      e.target.value = "";
    }
  };

  const handleGlobalXPSync = async () => {
    if (!confirm("ATENÇÃO: Isso irá recalcular o saldo de XP de TODOS os alunos com base no histórico de missões aprovadas e bônus. Deseja continuar?")) return;
    
    setLoading(true);
    try {
      // 1. Busca todos os usuários com paginação para cruzar IDs com UIDs e vencer limite de 1000
      let allUsers: any[] = [];
      let uPage = 0;
      let uHasMore = true;
      
      while(uHasMore) {
        const { data: uData, error: uErr } = await supabase
          .from("usuarios")
          .select("id, uid")
          .range(uPage * 1000, (uPage + 1) * 1000 - 1);
        
        if (uErr) throw uErr;
        if (uData && uData.length > 0) {
          allUsers = [...allUsers, ...uData];
          uPage++;
        } else {
          uHasMore = false;
        }
      }

      const userMap: Record<string, string> = {};
      allUsers.forEach(u => {
        userMap[u.id] = u.id; // Mapa id para id
        if (u.uid) userMap[u.uid] = u.id; // Mapa uid do firebase para id
      });

      // 2. Busca todas as missões aprovadas/bonus com paginação para vencer limite de 1000
      let allMissionsFromDB: any[] = [];
      let mPage = 0;
      let mHasMore = true;

      while (mHasMore) {
        const { data: mData, error: mErr } = await supabase
          .from("missoes")
          .select("student_id, status, xp_awarded")
          .in("status", ["approved", "bonus"])
          .range(mPage * 1000, (mPage + 1) * 1000 - 1);

        if (mErr) throw mErr;

        if (mData && mData.length > 0) {
          allMissionsFromDB = [...allMissionsFromDB, ...mData];
          mPage++;
        } else {
          mHasMore = false;
        }
      }

      // 3. Calcula o total por Aluno usando o ID principal (corrigindo conflito UID vs ID)
      const xpMap: Record<string, number> = {};
      allMissionsFromDB.forEach(m => {
        const xp = m.xp_awarded ? Number(m.xp_awarded) : (m.status === 'bonus' ? XP_BONUS : XP_PER_MISSION);
        const sId = m.student_id;
        const canonicalId = userMap[sId] || sId; // Busca ID unificado ou usa o atual

        if (!xpMap[canonicalId]) xpMap[canonicalId] = 0;
        xpMap[canonicalId] += xp;
      });

      // 4. Executa a atualização fracionada no Supabase
      const updates = Object.entries(xpMap).map(([id, totalXp]) =>
        supabase.from("usuarios").update({ xp: totalXp }).eq("id", id)
      );

      const chunkSize = 50;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        await Promise.all(chunk);
      }

      alert(`Sincronização global concluída! Saldo de XP de ${updates.length} alunos foram recalculados e corrigidos.`);
      fetchUsers(true); 
      fetchCounts();
    } catch (err: any) {
      console.error("Erro ao sincronizar XP:", err);
      alert("Erro ao recalcular XP: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalAlunos = counts.users.aluno;
  const avgXP = totalAlunos > 0 ? Math.round(users.filter(u => u.role === "aluno").reduce((acc, curr) => acc + (curr.xp || 0), 0) / (users.filter(u => u.role === "aluno").length || 1)) : 0;

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10">
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
              {profile.role === "master" ? "Gestão Global Master (Supabase)" : `Unidade: ${franquias.find(f => f.id === profile.franquiaId)?.nome || "Carregando..."}`}
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

      <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
        {profile.role !== "rh" && (
          <>
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
          </>
        )}
        {["master", "coordenador", "rh"].includes(profile.role) && (
          <button
            onClick={() => setActiveTab("ats")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === "ats" ? "bg-green-500 text-black neon-glow-green" : "text-gray-500 hover:text-white"
            )}
          >
            <Briefcase className="w-4 h-4" /> Agência (ATS)
          </button>
        )}
        {profile.role === "master" && (
          <>
            <button
              onClick={() => setActiveTab("courses")}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === "courses" ? "bg-mult-orange text-white neon-glow-orange" : "text-gray-500 hover:text-white"
              )}
            >
              <BookOpen className="w-4 h-4" /> Gestão de Cursos
            </button>
            <button
              onClick={() => setActiveTab("maintenance")}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === "maintenance" ? "bg-red-500 text-white neon-glow-red" : "text-gray-500 hover:text-white"
              )}
            >
              <Settings className="w-4 h-4" /> Manutenção
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <div className="glass-card p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
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
            <button 
              onClick={() => setShowAddUser(true)}
              className="flex-1 sm:flex-none bg-mult-orange hover:bg-mult-orange/90 text-white font-bold py-3 px-4 sm:px-6 rounded-xl transition-all text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2 neon-glow-orange"
            >
              <UserPlus className="w-4 h-4" /> Novo Usuário
            </button>
            {profile.role === "master" && (
              <button 
                onClick={() => setShowImportModal(true)}
                className="flex-1 sm:flex-none bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue border border-neon-blue/30 font-bold py-3 px-4 sm:px-6 rounded-xl transition-all text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Importar <span className="hidden sm:inline">Alunos (CSV)</span>
              </button>
            )}
          </div>
        </div>

        {activeTab === "users" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <button 
              onClick={() => { setRoleFilter("aluno"); }}
              className={cn(
                "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all text-left",
                roleFilter === "aluno" ? "border-neon-blue bg-neon-blue/10" : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue neon-glow-blue border border-neon-blue/20">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Alunos</p>
                <p className="text-xl sm:text-2xl font-black">{counts.users.aluno}</p>
              </div>
            </button>

            <button 
              onClick={() => { setRoleFilter("professor"); }}
              className={cn(
                "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all text-left",
                roleFilter === "professor" ? "border-mult-orange bg-mult-orange/10" : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange border border-mult-orange/20">
                <Rocket className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Professores</p>
                <p className="text-xl sm:text-2xl font-black">{counts.users.professor}</p>
              </div>
            </button>

            <button 
              onClick={() => { setRoleFilter("coordenador"); }}
              className={cn(
                "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all text-left",
                roleFilter === "coordenador" ? "border-purple-500 bg-purple-500/10" : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 neon-glow-purple border border-purple-500/20">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Coordenadores</p>
                <p className="text-xl sm:text-2xl font-black">{counts.users.coordenador}</p>
              </div>
            </button>

            <button 
              onClick={() => { setRoleFilter("rh"); }}
              className={cn(
                "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all text-left",
                roleFilter === "rh" ? "border-pink-500 bg-pink-500/10" : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400 neon-glow-pink border border-pink-500/20">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">RH</p>
                <p className="text-xl sm:text-2xl font-black">{counts.users.rh}</p>
              </div>
            </button>

            <button 
              onClick={() => { setRoleFilter("all"); }}
              className={cn(
                "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all text-left",
                roleFilter === "all" ? "border-white bg-white/5" : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Geral</p>
                <p className="text-xl sm:text-2xl font-black">{counts.users.total}</p>
              </div>
            </button>
          </div>
        ) : activeTab === "activities" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <div className="glass-card p-5 sm:p-6 flex items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue border border-neon-blue/20">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Missões</p>
                <p className="text-xl sm:text-2xl font-black">{counts.missions.total}</p>
              </div>
            </div>

            <button 
              onClick={() => setActivityStatusFilter("pending")}
              className={cn(
                "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all text-left",
                activityStatusFilter === "pending" ? "border-yellow-500 bg-yellow-500/10" : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 border border-yellow-500/20">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pendentes</p>
                <p className="text-xl sm:text-2xl font-black">{counts.missions.pending}</p>
              </div>
            </button>

            <button 
              onClick={() => setActivityStatusFilter("approved")}
              className={cn(
                "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all text-left",
                activityStatusFilter === "approved" ? "border-green-500 bg-green-500/10" : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Aprovadas</p>
                <p className="text-xl sm:text-2xl font-black">{counts.missions.approved}</p>
              </div>
            </button>

            <button 
              onClick={() => setActivityStatusFilter("bonus")}
              className={cn(
                "glass-card p-5 sm:p-6 flex items-center gap-4 transition-all text-left",
                activityStatusFilter === "bonus" ? "border-purple-500 bg-purple-500/10" : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Bônus</p>
                <p className="text-xl sm:text-2xl font-black">{counts.missions.bonus}</p>
              </div>
            </button>
          </div>
        ) : null}
      </div>

      {activeTab === "ats" ? (
        <AtsDashboard profile={profile} />
      ) : activeTab === "users" ? (
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                Relatório de Desempenho (Supabase)
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
                  <option value="rh">Estagiária de RH</option>
                </select>
                {roleFilter === "aluno" && (
                  <select 
                    value={turmaFilter}
                    onChange={(e) => setTurmaFilter(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-neon-blue transition-all"
                  >
                    <option value="all">Todas as Turmas</option>
                    {turmas.map(t => (
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
                placeholder="Buscar por nome ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-neon-blue transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="hidden md:table w-full text-left border-collapse min-w-[600px]">
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
                {users.map((userItem) => {
                  const rank = RANKS.reduce((prev, curr) => (userItem.xp >= curr.minXP ? curr : prev), RANKS[0]);
                  return (
                    <tr key={userItem.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-neon-blue transition-colors shrink-0">
                            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs sm:text-sm truncate">{userItem.displayName}</p>
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
                          {franquias.find(f => f.id === userItem.franquiaId)?.nome || userItem.franquiaId || "Global"}
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="p-6 border-t border-white/5 bg-white/5 flex justify-center">
              <button 
                onClick={() => fetchUsers(false)}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-neon-blue text-black font-black uppercase tracking-widest text-xs neon-glow-blue disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Carregar Mais Usuários"}
              </button>
            </div>
          )}
        </div>
      ) : activeTab === "activities" ? (
        <div className="glass-card overflow-hidden">
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
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allMissions.map((mission) => (
                  <tr key={mission.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-xs sm:text-sm">{mission.studentName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-medium text-gray-300">{getRelativeLesson(mission.classNum).label}</p>
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
                        {franquias.find(f => f.id === mission.franquiaId)?.nome || mission.franquiaId || "N/A"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedMissionForView(mission)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-neon-blue hover:text-black transition-all border border-white/10"
                        title="Visualizar Missão"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMoreMissions && (
            <div className="p-6 border-t border-white/5 bg-white/5 flex justify-center">
              <button 
                onClick={() => fetchMissions(false)}
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-mult-orange text-white font-black uppercase tracking-widest text-xs neon-glow-orange disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Carregar Mais Atividades"}
              </button>
            </div>
          )}
        </div>
      ) : activeTab === "courses" ? (
        <CourseManager courses={courses} />
      ) : activeTab === "maintenance" ? (
        <div className="space-y-8">
          <div className="glass-card p-8 border-neon-blue/20 bg-neon-blue/5">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-neon-blue/20 flex items-center justify-center text-neon-blue shrink-0 border border-neon-blue/30">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Sincronização / Carga Supabase</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Selecione o arquivo JSON de backup para popular ou sincronizar todas as tabelas do PostgreSQL no Supabase.
                  </p>
                </div>
                
                <div className="pt-4 flex items-center gap-4">
                  <input
                    type="file"
                    accept=".json"
                    id="supabase-backup-upload"
                    className="hidden"
                    onChange={handleUploadBackupToSupabase}
                    disabled={importingToSupabase}
                  />
                  <label
                    htmlFor="supabase-backup-upload"
                    className="cursor-pointer bg-neon-blue hover:bg-neon-blue/80 text-black font-black py-4 px-8 rounded-xl transition-all neon-glow-blue text-xs uppercase tracking-widest flex items-center gap-3"
                  >
                    {importingToSupabase ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                    {importingToSupabase ? "Processando..." : "Sincronizar Arquivo JSON"}
                  </label>
                </div>

                {supabaseImportReport && (
                  <div className="p-4 bg-black/60 rounded-xl border border-white/5 space-y-2 mt-4 text-xs font-mono">
                    <p className="text-green-400 font-bold">Relatório de Carga:</p>
                    <p>Franquias: {supabaseImportReport.franquias?.inserted}/{supabaseImportReport.franquias?.total}</p>
                    <p>Usuários: {supabaseImportReport.users?.inserted}/{supabaseImportReport.users?.total}</p>
                    <p>Missões: {supabaseImportReport.missions?.inserted}/{supabaseImportReport.missions?.total}</p>
                    <p>Empresas: {supabaseImportReport.companies?.inserted}/{supabaseImportReport.companies?.total}</p>
                    <p>Vagas: {supabaseImportReport.vagas?.inserted}/{supabaseImportReport.vagas?.total}</p>
                    <p>Candidaturas: {supabaseImportReport.applications?.inserted}/{supabaseImportReport.applications?.total}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Módulo de Correção de XP (Global) */}
          <div className="glass-card p-8 border-mult-orange/20 bg-mult-orange/5">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-mult-orange/20 flex items-center justify-center text-mult-orange shrink-0 border border-mult-orange/30">
                <RefreshCw className="w-8 h-8" />
              </div>
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Recálculo Global de XP</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Varre o banco de dados e recalcula o saldo total de XP de todos os alunos com base nas missões que constam como Aprovadas ou Bônus no histórico. Ideal para corrigir dessincronizações pós-migração.
                  </p>
                </div>
                
                <div className="pt-4">
                  <button 
                    onClick={handleGlobalXPSync}
                    disabled={loading}
                    className="bg-mult-orange hover:bg-mult-orange/80 text-white font-black py-4 px-8 rounded-xl transition-all neon-glow-orange text-xs uppercase tracking-widest flex items-center gap-3 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    Sincronizar XP de Todos os Alunos
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : null}

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
                    <input 
                      type="email"
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-neon-blue"
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Matrícula / Código</label>
                    <input 
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
                      <option value="rh" className="bg-cockpit-bg">Estagiária de RH</option>
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
                  <Upload className="text-mult-orange w-6 h-6" /> IMPORTAR <span className="text-neon-blue">ALUNOS (CSV)</span>
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                  Cole os dados abaixo no formato CSV com cabeçalho para processamento em lotes por turma.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-black text-mult-orange uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" /> Formato Recomendado (Ponto e Vírgula):
                </p>
                <code className="text-[10px] text-gray-400 block bg-black/40 p-2 rounded font-mono">
                  Nome Completo;Código;Unidade;Senha Temporária;Turma<br/>
                  João Silva;12345;rio-verde;senha123;024inf<br/>
                  Maria Souza;67890;rio-verde;senha456;024inf
                </code>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Target className="w-3 h-3" /> Selecionar Curso Vinculado:
                  </label>
                  <select 
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-neon-blue transition-all"
                  >
                    {courses.map(course => (
                      <option key={course.id} value={course.id} className="bg-cockpit-bg">
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea 
                  value={importText}
                  onChange={e => { setImportText(e.target.value); setImportPreview([]); }}
                  placeholder="Cole aqui o conteúdo do seu CSV..."
                  className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-neon-blue transition-all"
                />
                
                <button 
                  onClick={handlePreviewImport}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/10 transition-all"
                >
                  PRÉ-VISUALIZAR DADOS
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
                        <th className="p-2 border-b border-white/10">Turma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-b border-white/5">
                          <td className="p-2">{row["Nome Completo"] || row["nome"]}</td>
                          <td className="p-2">{row["Código"] || row["codigo"] || row["Matrícula"] || row["matricula"]}</td>
                          <td className="p-2">{row["Unidade"] || row["unidade"]}</td>
                          <td className="p-2">{row["Turma"] || row["turma"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

        {/* MODAL 1: REVISAR MISSÃO E DAR XP (DA LUPA) */}
        {selectedMissionForView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-2xl p-6 sm:p-8 space-y-6 relative"
            >
              <button 
                onClick={() => setSelectedMissionForView(null)} 
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
              
              <div className="space-y-4 pr-8">
                <h2 className="text-xl sm:text-2xl font-black tracking-tighter flex items-center gap-3 uppercase">
                  <Search className="text-neon-blue w-6 h-6 shrink-0" /> REVISAR <span className="text-mult-orange">MISSÃO</span>
                </h2>
                
                {/* Cabeçalho do Aluno com Botão para Histórico */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                    Aluno: <span className="text-white">{selectedMissionForView.studentName}</span> <br/>
                    Atividade: <span className="text-white">{getRelativeLesson(selectedMissionForView.classNum).label}</span>
                  </p>
                  
                  <button
                    onClick={() => setShowMissionHistory({
                      id: selectedMissionForView.studentId,
                      uid: selectedMissionForView.studentId,
                      displayName: selectedMissionForView.studentName,
                      turma: selectedMissionForView.turma,
                      role: "aluno"
                    } as UserProfile)}
                    className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 shrink-0"
                  >
                    <Clock className="w-3 h-3" /> Ver Diário Antigo
                  </button>
                </div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl p-5 shadow-inner min-h-[120px] sm:min-h-[150px]">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FileText className="w-3 h-3" /> Conteúdo Enviado:
                </p>
                <p className="text-gray-300 italic whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                  "{selectedMissionForView.content}"
                </p>
              </div>

              {selectedMissionForView.status === "pending" ? (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                  <button 
                    disabled={loading}
                    onClick={() => handleRejectMission(selectedMissionForView)}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-black py-3 sm:py-4 rounded-xl transition-all disabled:opacity-50 uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4 shrink-0" /> REJEITAR
                  </button>
                  <button 
                    disabled={loading}
                    onClick={() => handleApproveMission(selectedMissionForView, false)}
                    className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/40 font-black py-3 sm:py-4 rounded-xl transition-all disabled:opacity-50 uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4 shrink-0" /> APROVAR (+{XP_PER_MISSION} XP)
                  </button>
                  <button 
                    disabled={loading}
                    onClick={() => handleApproveMission(selectedMissionForView, true)}
                    className="flex-1 bg-neon-blue hover:bg-neon-blue/90 text-black font-black py-3 sm:py-4 rounded-xl transition-all neon-glow-blue disabled:opacity-50 uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4 shrink-0" /> BÔNUS (+{XP_BONUS} XP)
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border border-white/10 rounded-xl bg-white/5">
                  <CheckCircle2 className="w-8 h-8 text-gray-500 mb-2" />
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest text-center">
                    Esta missão já foi avaliada ({selectedMissionForView.status})
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* MODAL 2: HISTÓRICO DE MISSÕES (DO OLHINHO E DO BOTÃO VER DIÁRIO ANTIGO) */}
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
