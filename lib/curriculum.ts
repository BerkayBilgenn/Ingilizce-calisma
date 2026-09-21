import source from "@/content/curriculum.json";

export type CurriculumWord = {
  term: string;
  meaning: string;
  pronunciation: string;
  level: string;
  category: string;
  dayNumber: number;
  position: number;
};

export const CURRICULUM_KEY = "english-1000-v2-random";
export const CURRICULUM_DAYS = 100;
export const curriculumWords: CurriculumWord[] = source;
