import { Badge, Rank } from "./types";

export const MODULES = ["Windows", "Internet", "Word", "PowerPoint", "Excel"];

export const CLASSES = Array.from({ length: 32 }, (_, i) => i + 1);

export const RANKS: Rank[] = [
  { name: "Trainee", minXP: 0, color: "text-gray-400" },
  { name: "Assistente Júnior", minXP: 500, color: "text-blue-400" },
  { name: "Analista", minXP: 1500, color: "text-green-400" },
  { name: "Especialista", minXP: 3000, color: "text-purple-400" },
];

export const BADGES: Badge[] = [
  {
    id: "pioneiro",
    name: "Pioneiro do Sistema",
    description: "Desbloqueado após a Aula 6",
    unlockClass: 6,
    icon: "Rocket",
  },
  {
    id: "explorador",
    name: "Explorador da Web",
    description: "Desbloqueado após a Aula 10",
    unlockClass: 10,
    icon: "Globe",
  },
  {
    id: "arquiteto",
    name: "Arquiteto de Carreiras",
    description: "Desbloqueado após a Aula 19",
    unlockClass: 19,
    icon: "Briefcase",
  },
  {
    id: "apresentador",
    name: "Apresentador Brilhante",
    description: "Desbloqueado após a Aula 24",
    unlockClass: 24,
    icon: "Presentation",
  },
  {
    id: "genio",
    name: "Gênio dos Dados",
    description: "Desbloqueado após a Aula 32",
    unlockClass: 32,
    icon: "Database",
  },
];

export const XP_PER_MISSION = 50;
export const XP_BONUS = 100;

export const ROLES_LABELS: Record<string, string> = {
  master: "Master",
  coordenador: "Coordenador",
  professor: "Professor",
  aluno: "Aluno",
  rh: "Estagiária de RH"
};
