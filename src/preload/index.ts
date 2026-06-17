import { contextBridge, ipcRenderer } from 'electron'
import type { LogEntry, Project, RoboNeoBridge, JobState, StoredChatMessage } from '../shared/types'

window.addEventListener('error', (event) => {
  ipcRenderer.send('renderer:error', {
    type: 'error',
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error instanceof Error ? event.error.stack : undefined
  })
})

window.addEventListener('unhandledrejection', (event) => {
  ipcRenderer.send('renderer:error', {
    type: 'unhandledrejection',
    reason: event.reason instanceof Error ? event.reason.stack : String(event.reason)
  })
})

const bridge: RoboNeoBridge = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  getProject: (id) => ipcRenderer.invoke('projects:get', id),
  createProject: (input) => ipcRenderer.invoke('projects:create', input),
  updateProject: (project) => ipcRenderer.invoke('projects:update', project),
  deleteProject: (id) => ipcRenderer.invoke('projects:delete', id),
  selectAsset: (input) => ipcRenderer.invoke('assets:select', input),
  selectChatAttachment: (input) => ipcRenderer.invoke('chat-attachments:select', input),
  listKeys: () => ipcRenderer.invoke('keys:list'),
  saveKey: (input) => ipcRenderer.invoke('keys:save', input),
  deleteKey: (id) => ipcRenderer.invoke('keys:delete', id),
  validateKey: (id) => ipcRenderer.invoke('keys:validate', id),
  loadKeyCredit: (id) => ipcRenderer.invoke('keys:credit', id),
  listRemoteHistory: (keyId) => ipcRenderer.invoke('history:list-remote', keyId),
  importRemoteHistoryRoom: (roomId, keyId) => ipcRenderer.invoke('history:import-room', roomId, keyId),
  saveKeyToConfig: (id) => ipcRenderer.invoke('keys:save-config', id),
  checkEnvironment: () => ipcRenderer.invoke('environment:check'),
  runProject: (id) => ipcRenderer.invoke('job:run', id),
  continueProject: (id) => ipcRenderer.invoke('job:continue', id),
  sendChatMessage: (input) => ipcRenderer.invoke('job:chat', input),
  cancelProject: (id) => ipcRenderer.invoke('job:cancel', id),
  replyToProject: (id, reply) => ipcRenderer.invoke('job:reply', id, reply),
  openOutputFolder: (id) => ipcRenderer.invoke('output:open', id),
  openPath: (path) => ipcRenderer.invoke('path:open', path),
  getProjectLogs: (id) => ipcRenderer.invoke('logs:list', id),
  getProjectChatMessages: (id) => ipcRenderer.invoke('chat:list', id),
  onLog: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry)
    ipcRenderer.on('roboneo:log', listener)
    return () => ipcRenderer.removeListener('roboneo:log', listener)
  },
  onChatMessage: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: StoredChatMessage) => callback(message)
    ipcRenderer.on('roboneo:chat-message', listener)
    return () => ipcRenderer.removeListener('roboneo:chat-message', listener)
  },
  onJobState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: JobState) => callback(state)
    ipcRenderer.on('roboneo:job-state', listener)
    return () => ipcRenderer.removeListener('roboneo:job-state', listener)
  },
  onProjectUpdated: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, project: Project) => callback(project)
    ipcRenderer.on('roboneo:project-updated', listener)
    return () => ipcRenderer.removeListener('roboneo:project-updated', listener)
  }
}

contextBridge.exposeInMainWorld('roboneo', bridge)
