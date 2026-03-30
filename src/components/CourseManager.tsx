"use client";

import React, { useState } from "react";
import { Course, Lesson } from "../types";
import { 
  BookOpen, 
  Plus, 
  Save, 
  Trash2, 
  Video, 
  FileText, 
  Target, 
  ChevronRight, 
  ChevronDown,
  Layout,
  Image as ImageIcon,
  Edit3,
  Trophy
} from "lucide-react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "motion/react";

interface CourseManagerProps {
  courses: Course[];
}

export default function CourseManager({ courses }: CourseManagerProps) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ moduleIndex: number; lessonIndex: number; lesson: Lesson } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showBadgeEditor, setShowBadgeEditor] = useState(false);

  const handleAddBadge = async () => {
    if (!selectedCourse) return;
    const newBadge = {
      id: `badge-${Date.now()}`,
      name: "Nova Medalha",
      description: "Descrição da medalha",
      icon: "Trophy",
      xpReward: 100
    };
    
    try {
      await updateDoc(doc(db, "courses", selectedCourse.id), {
        badges: arrayUnion(newBadge)
      });
    } catch (error) {
      console.error("Error adding badge:", error);
    }
  };

  const handleUpdateBadge = async (badgeId: string, updates: any) => {
    if (!selectedCourse) return;
    try {
      const updatedBadges = (selectedCourse.badges || []).map(b => 
        b.id === badgeId ? { ...b, ...updates } : b
      );
      await updateDoc(doc(db, "courses", selectedCourse.id), {
        badges: updatedBadges
      });
    } catch (error) {
      console.error("Error updating badge:", error);
    }
  };

  const handleRemoveBadge = async (badge: any) => {
    if (!selectedCourse) return;
    try {
      await updateDoc(doc(db, "courses", selectedCourse.id), {
        badges: arrayRemove(badge)
      });
    } catch (error) {
      console.error("Error removing badge:", error);
    }
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse || !editingLesson) return;

    setIsSaving(true);
    try {
      const updatedModules = [...selectedCourse.modules];
      updatedModules[editingLesson.moduleIndex].lessons[editingLesson.lessonIndex] = editingLesson.lesson;

      await updateDoc(doc(db, "courses", selectedCourse.id), {
        modules: updatedModules
      });

      setEditingLesson(null);
    } catch (error) {
      console.error("Error saving lesson:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLesson = async (moduleIndex: number) => {
    if (!selectedCourse) return;

    const module = selectedCourse.modules[moduleIndex];
    const nextNum = module.lessons.length > 0 
      ? Math.max(...module.lessons.map(l => l.num)) + 1 
      : 1;

    const newLesson: Lesson = {
      num: nextNum,
      title: `Nova Aula ${nextNum}`,
      description: "",
      videoUrl: "",
      missionChallenge: ""
    };

    try {
      const updatedModules = [...selectedCourse.modules];
      updatedModules[moduleIndex].lessons.push(newLesson);

      await updateDoc(doc(db, "courses", selectedCourse.id), {
        modules: updatedModules
      });
    } catch (error) {
      console.error("Error adding lesson:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tighter uppercase">Gestão de Cursos</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Editor de Cronograma e Conteúdo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Course List */}
        <div className="lg:col-span-1 space-y-2">
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`w-full p-4 rounded-xl border transition-all text-left flex items-center justify-between group ${
                selectedCourse?.id === course.id
                  ? "bg-mult-orange/10 border-mult-orange text-mult-orange neon-glow-orange"
                  : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5" />
                <span className="font-black uppercase tracking-tighter text-sm">{course.title}</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${selectedCourse?.id === course.id ? "rotate-90" : ""}`} />
            </button>
          ))}
        </div>

        {/* Course Content */}
        <div className="lg:col-span-3 space-y-6">
          {selectedCourse ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-mult-orange/20 flex items-center justify-center neon-glow-orange border border-mult-orange/30">
                    <Layout className="text-mult-orange w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter">{selectedCourse.title}</h3>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">ID: {selectedCourse.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowBadgeEditor(!showBadgeEditor)}
                  className="flex items-center gap-2 px-4 py-2 bg-mult-orange/10 hover:bg-mult-orange/20 text-mult-orange border border-mult-orange/30 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  <Trophy className="w-4 h-4" />
                  {showBadgeEditor ? "Ver Cronograma" : "Gerenciar Medalhas"}
                </button>
              </div>

              {showBadgeEditor ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black uppercase tracking-tighter">Medalhas do Curso</h3>
                    <button 
                      onClick={handleAddBadge}
                      className="flex items-center gap-2 px-4 py-2 bg-neon-blue/10 hover:bg-neon-blue/20 text-neon-blue border border-neon-blue/30 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Medalha
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedCourse.badges || []).map((badge) => (
                      <div key={badge.id} className="glass-card p-4 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                            {badge.icon.startsWith('http') ? (
                              <img src={badge.icon} alt={badge.name} className="w-8 h-8 object-contain" />
                            ) : (
                              <Trophy className="w-6 h-6 text-mult-orange" />
                            )}
                          </div>
                          <div className="flex-1">
                            <input 
                              value={badge.name}
                              onChange={(e) => handleUpdateBadge(badge.id, { name: e.target.value })}
                              className="w-full bg-transparent border-none p-0 font-bold text-sm focus:ring-0 text-white"
                              placeholder="Nome da Medalha"
                            />
                            <input 
                              value={badge.description}
                              onChange={(e) => handleUpdateBadge(badge.id, { description: e.target.value })}
                              className="w-full bg-transparent border-none p-0 text-[10px] text-gray-500 focus:ring-0"
                              placeholder="Descrição da Medalha"
                            />
                          </div>
                          <button 
                            onClick={() => handleRemoveBadge(badge)}
                            className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">XP Recompensa</label>
                            <input 
                              type="number"
                              value={badge.xpReward}
                              onChange={(e) => handleUpdateBadge(badge.id, { xpReward: Number(e.target.value) })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-mult-orange"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">URL do Ícone (PNG/SVG)</label>
                            <input 
                              value={badge.icon}
                              onChange={(e) => handleUpdateBadge(badge.id, { icon: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-mult-orange"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                selectedCourse.modules.map((module, mIdx) => (
                  <div key={mIdx} className="glass-card overflow-hidden">
                    <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Layout className="text-mult-orange w-5 h-5" />
                        <h3 className="font-black uppercase tracking-tighter text-lg">{module.name}</h3>
                      </div>
                      <button 
                        onClick={() => handleAddLesson(mIdx)}
                        className="p-2 hover:bg-mult-orange/20 rounded-lg text-mult-orange transition-colors"
                        title="Adicionar Aula"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="divide-y divide-white/5">
                      {module.lessons.map((lesson, lIdx) => (
                        <div key={lIdx} className="p-4 hover:bg-white/5 transition-colors group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-black text-xs text-gray-500">
                                {lesson.num}
                              </span>
                              <div>
                                <h4 className="font-bold uppercase tracking-tight text-sm group-hover:text-mult-orange transition-colors">
                                  {lesson.title}
                                </h4>
                                <div className="flex items-center gap-3 mt-1">
                                  {lesson.videoUrl && <Video className="w-3 h-3 text-neon-blue" />}
                                  {lesson.description && <FileText className="w-3 h-3 text-neon-green" />}
                                  {lesson.missionChallenge && <Target className="w-3 h-3 text-mult-orange" />}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setEditingLesson({ moduleIndex: mIdx, lessonIndex: lIdx, lesson: { ...lesson } })}
                              className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all"
                            >
                              <Edit3 className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl">
              <BookOpen className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-black uppercase tracking-widest text-xs">Selecione um curso para editar</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Lesson Modal */}
      <AnimatePresence>
        {editingLesson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingLesson(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-cockpit-bg border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-mult-orange/20 flex items-center justify-center neon-glow-orange">
                    <Edit3 className="text-mult-orange w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tighter uppercase leading-none">Editar Aula {editingLesson.lesson.num}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Configurações de Conteúdo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingLesson(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Título da Aula</label>
                    <input
                      type="text"
                      value={editingLesson.lesson.title}
                      onChange={(e) => setEditingLesson({ ...editingLesson, lesson: { ...editingLesson.lesson, title: e.target.value } })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-mult-orange outline-none transition-all font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Descrição / Conteúdo</label>
                    <textarea
                      value={editingLesson.lesson.description}
                      onChange={(e) => setEditingLesson({ ...editingLesson, lesson: { ...editingLesson.lesson, description: e.target.value } })}
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-mult-orange outline-none transition-all font-bold resize-none"
                      placeholder="O que o aluno vai aprender nesta aula?"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Link do Vídeo (YouTube/Vimeo)</label>
                    <div className="relative">
                      <Video className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={editingLesson.lesson.videoUrl}
                        onChange={(e) => setEditingLesson({ ...editingLesson, lesson: { ...editingLesson.lesson, videoUrl: e.target.value } })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-mult-orange outline-none transition-all font-bold"
                        placeholder="https://youtube.com/watch?v=..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Desafio / Missão (Instruções)</label>
                    <div className="relative">
                      <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={editingLesson.lesson.missionChallenge}
                        onChange={(e) => setEditingLesson({ ...editingLesson, lesson: { ...editingLesson.lesson, missionChallenge: e.target.value } })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-mult-orange outline-none transition-all font-bold text-mult-orange"
                        placeholder="Ex: Escreva um resumo sobre o que você entendeu..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  onClick={() => setEditingLesson(null)}
                  className="px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveLesson}
                  disabled={isSaving}
                  className="px-8 py-3 bg-mult-orange text-white rounded-xl font-black text-xs uppercase tracking-widest hover:neon-glow-orange transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : <><Save className="w-4 h-4" /> Salvar Alterações</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
