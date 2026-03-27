export const MODULE_CONFIG = [
  { name: "Windows", lessons: 6, startId: 1 },
  { name: "Internet", lessons: 4, startId: 7 },
  { name: "Word", lessons: 9, startId: 11 },
  { name: "PowerPoint", lessons: 5, startId: 20 },
  { name: "Excel", lessons: 8, startId: 25 },
];

export function getAbsoluteLessonId(moduleName: string, relativeLesson: number): number {
  const config = MODULE_CONFIG.find((m) => m.name === moduleName);
  if (!config) return relativeLesson;
  return config.startId + relativeLesson - 1;
}

export function getAbsoluteLesson(moduleName: string, relativeLesson: number): string {
  return `Aula ${getAbsoluteLessonId(moduleName, relativeLesson)}`;
}

export function getRelativeLesson(absoluteLesson: string | number) {
  // Extract number from "Aula X" or use number directly
  const absoluteId = typeof absoluteLesson === "string" 
    ? parseInt(absoluteLesson.replace("Aula ", ""), 10)
    : absoluteLesson;
  
  if (isNaN(absoluteId)) return { module: "Desconhecido", relativeLesson: 0, label: String(absoluteLesson) };

  const config = [...MODULE_CONFIG].reverse().find((m) => absoluteId >= m.startId);
  
  if (!config) return { module: "Desconhecido", relativeLesson: absoluteId, label: String(absoluteLesson) };

  const relativeLesson = absoluteId - config.startId + 1;
  return {
    module: config.name,
    relativeLesson,
    label: `${config.name} - Aula ${relativeLesson}`
  };
}

export function getLessonsForModule(moduleName: string): number[] {
  const config = MODULE_CONFIG.find((m) => m.name === moduleName);
  if (!config) return [];
  return Array.from({ length: config.lessons }, (_, i) => i + 1);
}
