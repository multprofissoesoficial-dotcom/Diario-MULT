"use client";

import React from "react";
import { motion } from "motion/react";
import { Enrollment, UserProfile } from "../types";
import { Rocket, ChevronRight, BookOpen, Clock } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

interface CourseLobbyProps {
  profile: UserProfile;
  enrollments: Enrollment[];
  onSelect: (courseId: string) => void;
}

export default function CourseLobby({ profile, enrollments, onSelect }: CourseLobbyProps) {
  const handleSelect = async (courseId: string) => {
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        currentCourseId: courseId
      });
      onSelect(courseId);
    } catch (error) {
      console.error("Error selecting course:", error);
    }
  };

  return (
    <div className="min-h-screen bg-cockpit-bg flex flex-col items-center justify-center p-6 sm:p-12">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 mb-12"
      >
        <div className="w-16 h-16 bg-mult-orange/20 rounded-2xl flex items-center justify-center mx-auto neon-glow-orange border border-mult-orange/30 mb-6">
          <Rocket className="text-mult-orange w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase">
          BEM-VINDO AO <span className="text-mult-orange">COCKPIT</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base font-medium uppercase tracking-widest">
          Selecione o curso que deseja pilotar hoje, {profile.displayName.split(' ')[0]}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
        {enrollments.map((enrollment, index) => (
          <motion.div
            key={enrollment.courseId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => handleSelect(enrollment.courseId)}
            className="glass-card p-8 group cursor-pointer hover:border-mult-orange/50 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
              <BookOpen className="w-20 h-20 text-mult-orange" />
            </div>

            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-mult-orange uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-mult-orange animate-pulse" />
                  {enrollment.status === "ativo" ? "Matrícula Ativa" : "Concluído"}
                </div>
                <h3 className="text-2xl font-black tracking-tighter uppercase leading-none group-hover:text-mult-orange transition-colors">
                  {enrollment.courseName}
                </h3>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Aula {enrollment.currentLesson}
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> {enrollment.unlockedBadges.length} Medalhas
                </div>
              </div>

              <button className="w-full py-4 bg-white/5 group-hover:bg-mult-orange group-hover:text-white text-gray-400 font-black rounded-xl border border-white/10 group-hover:border-mult-orange transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 group-hover:neon-glow-orange">
                ACESSAR CURSO <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="mt-12 text-[10px] text-gray-600 uppercase tracking-widest font-black">
        MULT PROFISSÕES • SISTEMA DE GESTÃO DE APRENDIZAGEM v2.0
      </p>
    </div>
  );
}
