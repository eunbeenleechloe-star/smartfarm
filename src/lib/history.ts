import type { CropId } from "@/types/analysis";

const HISTORY_STORAGE_KEY = "heukgisa_analysis_history";
const MAX_HISTORY = 20;

export type HistoryEntry = {
  id: string;
  cropId: CropId;
  address: string;
  date: string;
};

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: Omit<HistoryEntry, "id" | "date">): void {
  if (typeof window === "undefined") return;
  const next: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
  };
  const history = [next, ...getHistory()].slice(0, MAX_HISTORY);
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}
