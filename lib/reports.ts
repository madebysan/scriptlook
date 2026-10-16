// Single active project — persisted to localStorage.
// Scriptlook is single-project by design: one active project lives in localStorage.

import { normalizeScreenplayData } from "@/lib/schema";
import { migrateLegacyStorageKeys } from "@/lib/storage-migration";
import type { DeliverableId } from "@/lib/deliverables";

export type SavedImage = {
  status: "done";
  url: string;
};

export type SavedProject = {
  title: string;
  createdAt: string;
  jsonData?: string;
  deliverables?: DeliverableId[];
  documents: {
    name: string;
    slug: string;
    status: "done" | "error";
    content: string | null;
    error: string | null;
  }[];
  images?: Record<number, SavedImage>;
  promptOverrides?: Record<number, string>;
  posterImages?: Record<number, SavedImage>;
  portraits?: Record<string, SavedImage>;
  propImages?: Record<string, SavedImage>;
  locationImages?: Record<string, SavedImage>;
  disabledItems?: Record<string, boolean>;
};

export const PROJECT_KEY = "scriptlook-project";
export const API_KEY_STORAGE = "stp-api-key";
export const API_PROVIDER_STORAGE = "stp-api-provider";
export const FAL_KEY_STORAGE = "stp-fal-key";
export const TMDB_KEY_STORAGE = "stp-tmdb-key";

export function loadProject(): SavedProject | null {
  if (typeof window === "undefined") return null;
  try {
    migrateLegacyStorageKeys();
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const project = JSON.parse(raw) as SavedProject;
    if (project.jsonData) project.jsonData = normalizeScreenplayData(project.jsonData);
    return project;
  } catch {
    return null;
  }
}

export function saveProject(project: SavedProject): void {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  } catch {
    // Storage full — nothing to prune in single-project mode; give up silently.
  }
}

export function clearProject(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROJECT_KEY);
}

export function extractTitle(jsonData: string): string {
  try {
    const parsed = JSON.parse(jsonData);
    return parsed.title || "Untitled";
  } catch {
    return "Untitled";
  }
}
