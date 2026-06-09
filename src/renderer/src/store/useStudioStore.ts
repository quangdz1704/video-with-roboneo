import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, JobState, LogEntry, MaskedApiKey, Project } from '@shared/types'

interface StudioState {
  projects: Project[]
  keys: MaskedApiKey[]
  settings?: AppSettings
  selectedProjectId?: string
  logs: Record<string, LogEntry[]>
  jobs: Record<string, JobState>
  hydrated: boolean
  setProjects: (projects: Project[]) => void
  upsertProject: (project: Project) => void
  setKeys: (keys: MaskedApiKey[]) => void
  setSettings: (settings: AppSettings) => void
  selectProject: (id?: string) => void
  addLog: (log: LogEntry) => void
  setJob: (job: JobState) => void
  setHydrated: (value: boolean) => void
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      projects: [],
      keys: [],
      logs: {},
      jobs: {},
      hydrated: false,
      setProjects: (projects) => set({ projects }),
      upsertProject: (project) => set((state) => ({
        projects: [project, ...state.projects.filter((item) => item.id !== project.id)]
      })),
      setKeys: (keys) => set({ keys }),
      setSettings: (settings) => set({ settings }),
      selectProject: (selectedProjectId) => set({ selectedProjectId }),
      addLog: (log) => set((state) => ({
        logs: { ...state.logs, [log.projectId]: [...(state.logs[log.projectId] || []), log].slice(-2000) }
      })),
      setJob: (job) => set((state) => ({ jobs: { ...state.jobs, [job.projectId]: job } })),
      setHydrated: (hydrated) => set({ hydrated })
    }),
    {
      name: 'roboneo-studio-ui',
      partialize: (state) => ({ selectedProjectId: state.selectedProjectId })
    }
  )
)
