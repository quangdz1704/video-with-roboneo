import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { shell, type BrowserWindow } from 'electron'
import type { JobState, JobStep, LogEntry, Project } from '../../shared/types'
import { LocalProjectStorage } from '../storage/localProjectStorage'
import { RoboNeoAccountClient } from '../api/roboneoAccountClient'
import { ProcessManager, type CommandResult } from './processManager'

type HistoryPayload = Record<string, unknown> & {
  next_action?: unknown
  max_seq?: number
  last_seq?: number
  artifacts?: unknown[]
  request_id?: string
  last_request_id?: string
  message?: string
  recharge_url?: string
}

function parseJson(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const lines = trimmed.split(/\r?\n/).reverse()
    for (const line of lines) {
      try {
        return JSON.parse(line)
      } catch {
        continue
      }
    }
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('RoboNeo CLI did not return valid JSON')
  }
}

function findString(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  for (const key of keys) if (typeof record[key] === 'string') return record[key] as string
  for (const child of Object.values(record)) {
    const match = findString(child, keys)
    if (match) return match
  }
  return undefined
}

function historyPayload(value: Record<string, unknown>): HistoryPayload {
  const candidates = [value.data, value.result, value]
  return (candidates.find((item) => item && typeof item === 'object') || value) as HistoryPayload
}

function nextAction(payload: HistoryPayload): { action: string; rechargeUrl?: string; message?: string } {
  const raw = payload.next_action
  if (typeof raw === 'string') return { action: raw.toLowerCase() }
  if (raw && typeof raw === 'object') {
    const actionRecord = raw as Record<string, unknown>
    const extra = actionRecord.extra as Record<string, unknown> | undefined
    const recharge = extra?.recharge as Record<string, unknown> | undefined
    const items = Array.isArray(actionRecord.items) ? actionRecord.items : []
    const itemMessage = items
      .map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).content : undefined)
      .find((content): content is string => typeof content === 'string')
    return {
      action: String(actionRecord.action || 'poll').toLowerCase(),
      rechargeUrl: typeof recharge?.url === 'string' ? recharge.url : undefined,
      message: typeof recharge?.content === 'string' ? recharge.content : itemMessage
    }
  }
  return { action: String(findString(payload, ['action', 'next_action']) || 'poll').toLowerCase() }
}

export class RoboNeoRunner {
  private cancelled = new Set<string>()
  private accountClient = new RoboNeoAccountClient()

  constructor(
    private storage: LocalProjectStorage,
    private processes: ProcessManager,
    private getWindow: () => BrowserWindow | null
  ) {}

  private send(channel: string, payload: unknown): void {
    this.getWindow()?.webContents.send(channel, payload)
  }

  private log(projectId: string, message: string, stream: LogEntry['stream'] = 'system', step?: JobStep): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      projectId,
      timestamp: new Date().toISOString(),
      stream,
      message,
      step
    }
    this.send('roboneo:log', entry)
  }

  private state(projectId: string, step: JobStep, running: boolean, roomId?: string, lastSeq = 0, error?: string): void {
    const state: JobState = { projectId, step, running, roomId, lastSeq, error }
    this.send('roboneo:job-state', state)
  }

  private async command(projectId: string, args: string[], token?: string, step?: JobStep): Promise<CommandResult> {
    const settings = await this.storage.getSettings()
    const safeArgs = args.map((arg) => (token && arg === token ? '••••••••' : arg))
    this.log(projectId, `$ ${settings.cliPath} ${safeArgs.map((arg) => JSON.stringify(arg)).join(' ')}`, 'system', step)
    const result = await this.processes.run(
      projectId,
      settings.cliPath,
      args,
      { ...process.env, ...(token ? { ROBONEO_ACCESS_KEY: token } : {}) },
      (stream, chunk) => this.log(projectId, token ? chunk.replaceAll(token, '••••••••') : chunk, stream, step)
    )
    if (result.code !== 0) {
      const output = result.stderr.trim() || result.stdout.trim()
      if (output) {
        try {
          const payload = parseJson(output)
          throw new Error(findString(payload, ['error_msg', 'error', 'message']) || output)
        } catch (error) {
          if (error instanceof Error && error.message !== 'RoboNeo CLI did not return valid JSON') throw error
        }
      }
      throw new Error(`RoboNeo exited with code ${result.code}`)
    }
    return result
  }

  async checkEnvironment(): Promise<{ node: { ok: boolean; version?: string }; cli: { ok: boolean; version?: string; installCommand: string } }> {
    const settings = await this.storage.getSettings()
    const node = { ok: Boolean(process.versions.node), version: process.versions.node }
    try {
      const result = await this.processes.run('environment-check', settings.cliPath, ['--version'], process.env)
      return { node, cli: { ok: result.code === 0, version: (result.stdout || result.stderr).trim(), installCommand: 'npm install -g roboneo-cli' } }
    } catch {
      return { node, cli: { ok: false, installCommand: 'npm install -g roboneo-cli' } }
    }
  }

  async validateKey(id: string): Promise<{ ok: boolean; message: string }> {
    const key = await this.storage.getKey(id)
    if (!key) return { ok: false, message: 'API key not found' }
    try {
      await this.accountClient.validateToken(key.apiKey)
      return { ok: true, message: 'Token is valid' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async loadKeyCredit(id: string): Promise<{ ok: boolean; balance?: string; message: string; keys: Awaited<ReturnType<LocalProjectStorage['listKeys']>> }> {
    const key = await this.storage.getKey(id)
    if (!key) return { ok: false, message: 'API key not found', keys: await this.storage.listKeys() }
    try {
      const balance = await this.accountClient.getCredit(key.apiKey)
      const keys = await this.storage.saveKeyCredit(id, balance)
      return { ok: true, balance, message: `Balance: ${balance} carrots`, keys }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        message,
        keys: await this.storage.saveKeyCreditError(id, message)
      }
    }
  }

  async saveKeyToConfig(id: string): Promise<{ ok: boolean; message: string }> {
    const key = await this.storage.getKey(id)
    if (!key) return { ok: false, message: 'API key not found' }
    try {
      await this.command('save-key-config', ['config', 'access_token', key.apiKey], key.apiKey)
      return { ok: true, message: 'Saved to RoboNeo CLI config' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async run(projectId: string): Promise<void> {
    this.cancelled.delete(projectId)
    let project = await this.storage.getProject(projectId)
    if (!project) throw new Error('Project not found')
    const key = project.apiKeyId ? await this.storage.getKey(project.apiKeyId) : null
    if (!key || key.status !== 'active') throw new Error('Select an active RoboNeo API key')
    const mode = project.mode || 'motion_reference'
    if (mode === 'motion_reference' && (!project.assets.characterImage || !project.assets.referenceVideo)) {
      throw new Error('Motion Reference requires a character image and a reference video')
    }
    if (mode === 'image_to_video' && !project.assets.characterImage) {
      throw new Error('Image to Video requires a reference image')
    }
    if (!project.finalPrompt) throw new Error('Review and save a final prompt before running')

    try {
      project = await this.updateProject({ ...project, status: 'running', error: undefined, pendingReply: undefined })
      this.state(projectId, 'checking_cli', true)
      await this.command(projectId, ['--version'], undefined, 'checking_cli')
      this.state(projectId, 'validating_token', true)
      await this.command(projectId, ['user-info'], key.apiKey, 'validating_token')

      this.state(projectId, 'creating_room', true)
      const roomResult = await this.command(projectId, ['create-room'], key.apiKey, 'creating_room')
      const roomId = findString(parseJson(roomResult.stdout), ['room_id', 'roomId', 'id'])
      if (!roomId) throw new Error('Could not parse room_id from create-room output')
      project = await this.updateProject({ ...project, roomId, outputFiles: [] })

      this.state(projectId, 'sending_prompt', true, roomId)
      const args: string[] = ['chat', '-p', project.finalPrompt!, '--lang', project.language, '--room-id', roomId]
      if (mode === 'motion_reference') {
        args.push('--image-file', project.assets.characterImage!)
        if (project.assets.secondImage) args.push('--image-file', project.assets.secondImage)
        args.push('--video-file', project.assets.referenceVideo!)
      }
      if (mode === 'image_to_video') {
        args.push('--image-file', project.assets.characterImage!)
        if (project.assets.secondImage) args.push('--image-file', project.assets.secondImage)
      }
      await this.command(projectId, args, key.apiKey, 'sending_prompt')
      await this.storage.markKeyUsed(key.id)
      await this.poll(project, key.apiKey, 0)
    } catch (error) {
      if (this.cancelled.has(projectId)) return
      const message = error instanceof Error ? error.message : String(error)
      const latest = await this.storage.getProject(projectId)
      if (latest) await this.updateProject({ ...latest, status: 'failed', error: message })
      this.log(projectId, message, 'stderr', 'failed')
      this.state(projectId, 'failed', false, project.roomId, 0, message)
    }
  }

  private async poll(project: Project, token: string, initialSeq: number): Promise<void> {
    const settings = await this.storage.getSettings()
    let lastSeq = initialSeq
    while (!this.cancelled.has(project.id)) {
      this.state(project.id, 'polling', true, project.roomId, lastSeq)
      const args = ['history-detail', '-r', project.roomId!]
      if (lastSeq > 0) args.push('--after-seq', String(lastSeq))
      const result = await this.command(project.id, args, token, 'polling')
      const payload = historyPayload(parseJson(result.stdout))
      lastSeq = Number(payload.max_seq ?? payload.last_seq ?? findString(payload, ['max_seq', 'last_seq']) ?? lastSeq)
      const next = nextAction(payload)
      const action = next.action

      if (action === 'done') {
        await this.download(project, token)
        return
      }
      if (action === 'reply') {
        const requestId = findString(payload, ['last_request_id', 'request_id', 'block_id', 'id'])
        if (!requestId) throw new Error('RoboNeo requested a reply but no request ID was returned')
        await this.updateProject({
          ...project,
          status: 'waiting_reply',
          pendingReply: { requestId, message: payload.message }
        })
        this.state(project.id, 'waiting_reply', false, project.roomId, lastSeq)
        return
      }
      if (action === 'recharge') {
        const rechargeUrl = next.rechargeUrl || findString(payload, ['recharge_url'])
        if (rechargeUrl && /^https?:\/\//i.test(rechargeUrl)) await shell.openExternal(rechargeUrl)
        const message = next.message || (rechargeUrl ? `Quota exhausted. Recharge at ${rechargeUrl}` : 'RoboNeo quota exhausted. Please recharge your account.')
        throw new Error(message)
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(3000, settings.pollIntervalMs)))
      project = (await this.storage.getProject(project.id)) || project
    }
  }

  async reply(projectId: string, reply: string): Promise<void> {
    const project = await this.storage.getProject(projectId)
    if (!project?.pendingReply || !project.roomId || !project.apiKeyId) throw new Error('No pending RoboNeo reply')
    const key = await this.storage.getKey(project.apiKeyId)
    if (!key) throw new Error('API key not found')
    await this.updateProject({ ...project, status: 'running', pendingReply: undefined })
    await this.command(projectId, ['reply', '-r', project.roomId, '--last-request-id', project.pendingReply.requestId, '-p', reply], key.apiKey, 'sending_prompt')
    await this.poll(project, key.apiKey, 0)
  }

  private async download(project: Project, token: string): Promise<void> {
    const settings = await this.storage.getSettings()
    const outputDir = this.storage.outputDir(project, settings)
    this.state(project.id, 'downloading', true, project.roomId)
    await this.command(project.id, ['download', '-r', project.roomId!, '-o', outputDir], token, 'downloading')
    const files = await this.findOutputFiles(outputDir)
    const completed = await this.updateProject({ ...project, status: 'completed', outputFiles: files, pendingReply: undefined })
    this.log(project.id, `Downloaded ${files.length} artifact file(s) to ${outputDir}`, 'system', 'completed')
    this.state(project.id, 'completed', false, completed.roomId)
  }

  private async findOutputFiles(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const nested = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) return this.findOutputFiles(fullPath)
        return /\.(mp4|mov|png|jpe?g|webp|gif)$/i.test(entry.name) ? [fullPath] : []
      }))
      return nested.flat()
    } catch {
      return []
    }
  }

  async cancel(projectId: string): Promise<void> {
    this.cancelled.add(projectId)
    this.processes.cancel(projectId)
    const project = await this.storage.getProject(projectId)
    if (project) await this.updateProject({ ...project, status: 'cancelled' })
    this.log(projectId, 'Job cancelled by user', 'system', 'cancelled')
    this.state(projectId, 'cancelled', false, project?.roomId)
  }

  private async updateProject(project: Project): Promise<Project> {
    const saved = await this.storage.saveProject(project)
    this.send('roboneo:project-updated', saved)
    return saved
  }
}
