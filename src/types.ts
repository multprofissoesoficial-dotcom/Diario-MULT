export type UserRole = "master" | "coordenador" | "professor" | "aluno";

export interface Franquia {
  id: string;
  nome: string;
  cidade: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  codigo?: string; // Registration code for students
  role: UserRole;
  franquiaId?: string; // Master doesn't necessarily have one
  xp: number;
  unlockedBadges: string[];
  createdAt: string;
}

export interface Mission {
  id: string;
  studentId: string;
  studentName: string;
  franquiaId: string;
  module: string;
  classNum: number;
  content: string;
  status: "pending" | "approved" | "bonus";
  aiFeedback?: string;
  xpAwarded?: number;
  createdAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  unlockClass: number;
  icon: string;
}

export interface Rank {
  name: string;
  minXP: number;
  color: string;
}
