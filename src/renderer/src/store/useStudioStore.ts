import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppSettings,
  JobState,
  LogEntry,
  MaskedApiKey,
  Project,
  StoredChatMessage,
} from "@shared/types";

interface StudioState {
  projects: Project[];
  keys: MaskedApiKey[];
  settings?: AppSettings;
  selectedProjectId?: string;
  logs: Record<string, LogEntry[]>;
  chatMessages: Record<string, StoredChatMessage[]>;
  jobs: Record<string, JobState>;
  hydrated: boolean;
  setProjects: (projects: Project[]) => void;
  upsertProject: (project: Project) => void;
  setKeys: (keys: MaskedApiKey[]) => void;
  setSettings: (settings: AppSettings) => void;
  selectProject: (id?: string) => void;
  addLog: (log: LogEntry) => void;
  setLogs: (projectId: string, logs: LogEntry[]) => void;
  setChatMessages: (projectId: string, messages: StoredChatMessage[]) => void;
  addChatMessage: (message: StoredChatMessage) => void;
  setJob: (job: JobState) => void;
  setHydrated: (value: boolean) => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      projects: [],
      keys: [],
      logs: {},
      chatMessages: {},
      jobs: {},
      hydrated: false,
      setProjects: (projects) => set({ projects }),
      upsertProject: (project) =>
        set((state) => ({
          projects: [
            project,
            ...state.projects.filter((item) => item.id !== project.id),
          ],
        })),
      setKeys: (keys) => set({ keys }),
      setSettings: (settings) => set({ settings }),
      selectProject: (selectedProjectId) => set({ selectedProjectId }),
      addLog: (log) =>
        set((state) => ({
          logs: {
            ...state.logs,
            [log.projectId]: [...(state.logs[log.projectId] || []), log].slice(
              -2000,
            ),
          },
        })),
      setLogs: (projectId, logs) =>
        set((state) => ({ logs: { ...state.logs, [projectId]: logs } })),
      setChatMessages: (projectId, messages) =>
        set((state) => ({
          chatMessages: { ...state.chatMessages, [projectId]: messages },
        })),
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: {
            ...state.chatMessages,
            [message.projectId]: [
              ...(state.chatMessages[message.projectId] || []).filter(
                (item) => item.id !== message.id,
              ),
              message,
            ].slice(-1000),
          },
        })),
      setJob: (job) =>
        set((state) => ({ jobs: { ...state.jobs, [job.projectId]: job } })),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "roboneo-studio-ui",
      partialize: (state) => ({ selectedProjectId: state.selectedProjectId }),
    },
  ),
);
