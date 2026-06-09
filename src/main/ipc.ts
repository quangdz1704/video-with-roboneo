import { dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { stat } from 'node:fs/promises'
import type { AssetSelection, AppSettings, Project, SaveApiKeyInput } from '../shared/types'
import { LocalProjectStorage } from './storage/localProjectStorage'
import { RoboNeoRunner } from './cli/roboneoRunner'
import { logger } from './logger'

export function registerIpc(storage: LocalProjectStorage, runner: RoboNeoRunner): void {
  ipcMain.on('renderer:error', (_event, payload: unknown) => logger.error('renderer:window', payload))
  ipcMain.handle('settings:get', () => storage.getSettings())
  ipcMain.handle('settings:save', (_event, settings: AppSettings) => storage.saveSettings(settings))
  ipcMain.handle('projects:list', () => storage.listProjects())
  ipcMain.handle('projects:get', (_event, id: string) => storage.getProject(id))
  ipcMain.handle('projects:create', (_event, input: Partial<Project>) => storage.createProject(input))
  ipcMain.handle('projects:update', (_event, project: Project) => storage.saveProject(project))
  ipcMain.handle('projects:delete', (_event, id: string) => storage.deleteProject(id))
  ipcMain.handle('keys:list', () => storage.listKeys())
  ipcMain.handle('keys:save', (_event, input: SaveApiKeyInput) => storage.saveKey(input))
  ipcMain.handle('keys:delete', (_event, id: string) => storage.deleteKey(id))
  ipcMain.handle('keys:validate', (_event, id: string) => runner.validateKey(id))
  ipcMain.handle('keys:credit', (_event, id: string) => runner.loadKeyCredit(id))
  ipcMain.handle('keys:save-config', (_event, id: string) => runner.saveKeyToConfig(id))
  ipcMain.handle('environment:check', () => runner.checkEnvironment())
  ipcMain.handle('job:run', (_event, projectId: string) => runner.run(projectId))
  ipcMain.handle('job:cancel', (_event, projectId: string) => runner.cancel(projectId))
  ipcMain.handle('job:reply', (_event, projectId: string, reply: string) => runner.reply(projectId, reply))
  ipcMain.handle('path:open', (_event, target: string) => shell.openPath(target))
  ipcMain.handle('output:open', async (_event, projectId: string) => {
    const project = await storage.getProject(projectId)
    if (!project) return
    const settings = await storage.getSettings()
    await shell.openPath(storage.outputDir(project, settings))
  })
  ipcMain.handle('assets:select', async (_event, input: AssetSelection) => {
    const isImage = input.kind === 'image'
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: isImage
        ? [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }]
        : [{ name: 'Videos', extensions: ['mp4', 'mov'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const source = result.filePaths[0]
    const extension = path.extname(source).toLowerCase()
    if (isImage && !['.jpg', '.jpeg', '.png'].includes(extension)) throw new Error('Only JPG, JPEG, and PNG images are supported')
    if (!isImage && !['.mp4', '.mov'].includes(extension)) throw new Error('Only MP4 and MOV videos are supported')
    const size = (await stat(source)).size
    if (isImage && size > 20 * 1024 * 1024) throw new Error('Images must be 20MB or smaller')
    if (!isImage && size > 500 * 1024 * 1024) throw new Error('Videos must be 500MB or smaller')
    return storage.copyInput(input.projectId, source, input.slot)
  })
}
