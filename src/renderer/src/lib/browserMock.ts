import type { AppSettings, MaskedApiKey, Project, RoboNeoBridge } from '@shared/types'

const settings: AppSettings = {
  cliPath: 'roboneo',
  outputFolder: '~/RoboNeoTikTokStudio/outputs',
  pollIntervalMs: 4000,
  defaultLanguage: 'en',
  defaultDuration: 8,
  defaultAspectRatio: '9:16',
  defaultResolution: '1080x1920'
}

let projects: Project[] = []
let keys: MaskedApiKey[] = []

export function createBrowserMock(): RoboNeoBridge {
  return {
    getSettings: async () => settings,
    saveSettings: async (value) => Object.assign(settings, value),
    listProjects: async () => projects,
    getProject: async (id) => projects.find((project) => project.id === id) || null,
    createProject: async (input) => {
      const now = new Date().toISOString()
      const project: Project = {
        id: input.id || crypto.randomUUID(),
        name: input.name || 'TikTok video draft',
        mode: input.mode || 'motion_reference',
        brief: '',
        mood: 'Modern and energetic',
        duration: 8,
        language: 'en',
        aspectRatio: '9:16',
        resolution: '1080x1920',
        apiKeyId: input.apiKeyId,
        assets: {},
        status: 'draft',
        outputFiles: [],
        createdAt: now,
        updatedAt: now
      }
      projects = [project, ...projects]
      return project
    },
    updateProject: async (project) => {
      projects = [project, ...projects.filter((item) => item.id !== project.id)]
      return project
    },
    deleteProject: async (id) => { projects = projects.filter((item) => item.id !== id) },
    selectAsset: async () => null,
    listKeys: async () => keys,
    saveKey: async (input) => {
      const id = input.id || crypto.randomUUID()
      const current = keys.find((key) => key.id === id)
      keys = [{
        id,
        label: input.label,
        status: input.status,
        note: input.note,
        usedCount: current?.usedCount || 0,
        lastUsedAt: current?.lastUsedAt,
        creditBalance: current?.creditBalance,
        creditLoadedAt: current?.creditLoadedAt,
        creditError: current?.creditError,
        maskedKey: input.apiKey ? `••••••••${input.apiKey.slice(-4)}` : current?.maskedKey || '••••••••'
      }, ...keys.filter((key) => key.id !== id)]
      return keys
    },
    deleteKey: async (id) => (keys = keys.filter((key) => key.id !== id)),
    validateKey: async () => ({ ok: true, message: 'Browser preview: validation is available in Electron.' }),
    loadKeyCredit: async (id) => {
      keys = keys.map((key) => key.id === id ? { ...key, creditBalance: '1,250', creditLoadedAt: new Date().toISOString() } : key)
      return { ok: true, balance: '1,250', message: 'Browser preview balance', keys }
    },
    saveKeyToConfig: async () => ({ ok: true, message: 'Browser preview: CLI config is available in Electron.' }),
    checkEnvironment: async () => ({
      node: { ok: true, version: 'Electron runtime' },
      cli: { ok: false, installCommand: 'npm install -g roboneo-cli' }
    }),
    runProject: async () => undefined,
    cancelProject: async () => undefined,
    replyToProject: async () => undefined,
    openOutputFolder: async () => undefined,
    openPath: async () => undefined,
    onLog: () => () => undefined,
    onJobState: () => () => undefined,
    onProjectUpdated: () => () => undefined
  }
}
