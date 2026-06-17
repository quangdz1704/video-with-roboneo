import { app, safeStorage } from 'electron'
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type { ApiKeyRecord, AppSettings, MaskedApiKey, Project, SaveApiKeyInput } from '../../shared/types'

interface StoredKey extends Omit<ApiKeyRecord, 'apiKey'> {
  encryptedKey: string
  encryption: 'safeStorage' | 'aes-gcm'
}

const defaults = (): AppSettings => ({
  cliPath: 'roboneo',
  outputFolder: path.join(os.homedir(), 'RoboNeoTikTokStudio', 'outputs'),
  pollIntervalMs: 4000,
  defaultLanguage: 'en',
  defaultDuration: 8,
  defaultAspectRatio: '9:16',
  defaultResolution: '1080x1920'
})

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

function normalizeAccessKey(value: string): string {
  let key = value.trim()
  const configMatch = key.match(/roboneo\s+config\s+access_token\s+["']?([^"'\s]+)["']?/i)
  if (configMatch) return configMatch[1]
  const envMatch = key.match(/(?:export\s+)?ROBONEO_ACCESS_KEY\s*=\s*["']?([^"'\s]+)["']?/i)
  if (envMatch) return envMatch[1]
  key = key.replace(/^["']|["']$/g, '')
  if (/^npm\s+\S+$/i.test(key)) key = key.replace(/^npm\s+/i, '')
  return key.trim()
}

function redactSecrets(value: string): string {
  return value.replace(/(_v2)[A-Za-z0-9+/=_-]{20,}/g, '$1***REDACTED***')
}

export class LocalProjectStorage {
  private root = path.join(os.homedir(), 'RoboNeoTikTokStudio')
  private projectsDir = path.join(this.root, 'projects')
  private configDir = path.join(app.getPath('userData'), 'config')

  async init(): Promise<void> {
    await Promise.all([
      mkdir(this.projectsDir, { recursive: true }),
      mkdir(this.configDir, { recursive: true }),
      mkdir(path.join(this.root, 'outputs'), { recursive: true })
    ])
  }

  projectDir(id: string): string {
    return path.join(this.projectsDir, id)
  }

  outputDir(project: Project, settings: AppSettings): string {
    return path.join(settings.outputFolder, project.id)
  }

  async canReadAsset(filePath: string): Promise<boolean> {
    const settings = await this.getSettings()
    const resolved = path.resolve(filePath)
    return [this.projectsDir, settings.outputFolder].some((root) => {
      const relative = path.relative(path.resolve(root), resolved)
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
    })
  }

  async getSettings(): Promise<AppSettings> {
    return { ...defaults(), ...(await readJson<Partial<AppSettings>>(path.join(this.configDir, 'settings.json'), {})) }
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    await mkdir(settings.outputFolder, { recursive: true })
    await writeFile(path.join(this.configDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf8')
    return settings
  }

  async listProjects(): Promise<Project[]> {
    const indexFile = path.join(this.projectsDir, 'index.json')
    const index = await readJson<string[]>(indexFile, [])
    const projects = await Promise.all(index.map((id) => this.getProject(id)))
    const validProjects = projects.filter((item): item is Project => Boolean(item))
    const legacyEmptyDrafts = validProjects.filter((project) =>
      project.status === 'draft' &&
      /^TikTok video \d{1,2}\/\d{1,2}\/\d{4}$/.test(project.name) &&
      !project.brief &&
      !project.promptPack &&
      !project.finalPrompt &&
      !project.roomId &&
      Object.keys(project.assets).length === 0
    )
    if (legacyEmptyDrafts.length) {
      const removed = new Set(legacyEmptyDrafts.map((project) => project.id))
      await Promise.all(legacyEmptyDrafts.map((project) => rm(this.projectDir(project.id), { recursive: true, force: true })))
      await writeFile(indexFile, JSON.stringify(index.filter((id) => !removed.has(id)), null, 2), 'utf8')
    }
    return validProjects
      .filter((project) => !legacyEmptyDrafts.includes(project))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getProject(id: string): Promise<Project | null> {
    const project = await readJson<Partial<Project> | null>(path.join(this.projectDir(id), 'project.json'), null)
    if (!project?.id) return null
    const settings = await this.getSettings()
    const now = new Date().toISOString()
    return {
      id: project.id,
      name: project.name || 'Untitled RoboNeo project',
      mode: project.mode || 'motion_reference',
      brief: project.brief || '',
      mood: project.mood || 'Modern and energetic',
      duration: project.duration || settings.defaultDuration,
      language: project.language || settings.defaultLanguage,
      aspectRatio: project.aspectRatio || settings.defaultAspectRatio,
      resolution: project.resolution || settings.defaultResolution,
      apiKeyId: project.apiKeyId,
      assets: project.assets || {},
      promptPack: project.promptPack,
      finalPrompt: project.finalPrompt,
      roomId: project.roomId,
      status: project.status || 'draft',
      outputFiles: project.outputFiles || [],
      createdAt: project.createdAt || now,
      updatedAt: project.updatedAt || now,
      error: project.error,
      lastSeq: project.lastSeq,
      remoteHistory: project.remoteHistory,
      pendingReply: project.pendingReply
    }
  }

  async findProjectByRoomId(roomId: string): Promise<Project | null> {
    const projects = await this.listProjects()
    return projects.find((project) => project.roomId === roomId) || null
  }

  async createProject(input: Partial<Project>): Promise<Project> {
    const id = input.id || randomUUID()
    const now = new Date().toISOString()
    const settings = await this.getSettings()
    const project: Project = {
      id,
      name: input.name || `TikTok video ${new Date().toLocaleDateString()}`,
      mode: input.mode || 'motion_reference',
      brief: input.brief || '',
      mood: input.mood || 'Modern and energetic',
      duration: input.duration || settings.defaultDuration,
      language: input.language || settings.defaultLanguage,
      aspectRatio: input.aspectRatio || settings.defaultAspectRatio,
      resolution: input.resolution || settings.defaultResolution,
      apiKeyId: input.apiKeyId,
      assets: input.assets || {},
      promptPack: input.promptPack,
      finalPrompt: input.finalPrompt,
      roomId: input.roomId,
      status: input.status || 'draft',
      outputFiles: input.outputFiles || [],
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,
      error: input.error,
      lastSeq: input.lastSeq,
      remoteHistory: input.remoteHistory,
      pendingReply: input.pendingReply
    }
    await mkdir(path.join(this.projectDir(id), 'inputs'), { recursive: true })
    const saved = await this.saveProject(project)
    const indexFile = path.join(this.projectsDir, 'index.json')
    const index = await readJson<string[]>(indexFile, [])
    await writeFile(indexFile, JSON.stringify([id, ...index.filter((item) => item !== id)], null, 2), 'utf8')
    return saved
  }

  async saveProject(project: Project): Promise<Project> {
    const next = { ...project, mode: project.mode || 'motion_reference', updatedAt: new Date().toISOString() }
    await mkdir(this.projectDir(project.id), { recursive: true })
    await writeFile(path.join(this.projectDir(project.id), 'project.json'), JSON.stringify(next, null, 2), 'utf8')
    return next
  }

  async deleteProject(id: string): Promise<void> {
    await rm(this.projectDir(id), { recursive: true, force: true })
    const indexFile = path.join(this.projectsDir, 'index.json')
    const index = await readJson<string[]>(indexFile, [])
    await writeFile(indexFile, JSON.stringify(index.filter((item) => item !== id), null, 2), 'utf8')
  }

  async copyInput(projectId: string, source: string, slot: string): Promise<string> {
    const ext = path.extname(source).toLowerCase()
    const destination = path.join(this.projectDir(projectId), 'inputs', `${slot}${ext}`)
    await copyFile(source, destination)
    return destination
  }

  async copyAttachment(projectId: string, source: string): Promise<string> {
    const ext = path.extname(source).toLowerCase()
    const basename = path.basename(source, ext).replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 80) || 'attachment'
    const destination = path.join(this.projectDir(projectId), 'attachments', `${Date.now()}-${basename}${ext}`)
    await mkdir(path.dirname(destination), { recursive: true })
    await copyFile(source, destination)
    return destination
  }

  private fallbackKey(): Buffer {
    return createHash('sha256').update(`${app.getPath('userData')}:${os.hostname()}:RoboNeoTikTokStudio`).digest()
  }

  private encrypt(value: string): Pick<StoredKey, 'encryptedKey' | 'encryption'> {
    if (safeStorage.isEncryptionAvailable()) {
      return { encryptedKey: safeStorage.encryptString(value).toString('base64'), encryption: 'safeStorage' }
    }
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.fallbackKey(), iv)
    const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return {
      encryptedKey: Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64'),
      encryption: 'aes-gcm'
    }
  }

  private decrypt(record: StoredKey): string {
    const payload = Buffer.from(record.encryptedKey, 'base64')
    if (record.encryption === 'safeStorage') return safeStorage.decryptString(payload)
    const decipher = createDecipheriv('aes-256-gcm', this.fallbackKey(), payload.subarray(0, 12))
    decipher.setAuthTag(payload.subarray(12, 28))
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8')
  }

  private async storedKeys(): Promise<StoredKey[]> {
    const file = path.join(this.configDir, 'keys.json')
    const keys = await readJson<StoredKey[]>(file, [])
    let changed = false
    for (const key of keys) {
      const decrypted = this.decrypt(key)
      const normalized = normalizeAccessKey(decrypted)
      if (normalized && normalized !== decrypted) {
        Object.assign(key, this.encrypt(normalized))
        key.creditBalance = undefined
        key.creditLoadedAt = undefined
        key.creditError = 'API key was normalized after removing copied command text. Validate it again.'
        changed = true
      }
      if (key.creditError) {
        const redactedError = redactSecrets(key.creditError)
        if (redactedError !== key.creditError) {
          key.creditError = redactedError
          changed = true
        }
      }
    }
    if (changed) await writeFile(file, JSON.stringify(keys, null, 2), 'utf8')
    return keys
  }

  async listKeys(): Promise<MaskedApiKey[]> {
    return (await this.storedKeys()).map(({ encryptedKey, encryption, ...key }) => ({
      ...key,
      maskedKey: `••••••••${this.decrypt({ ...key, encryptedKey, encryption }).slice(-4)}`
    }))
  }

  async getKey(id: string): Promise<ApiKeyRecord | null> {
    const record = (await this.storedKeys()).find((key) => key.id === id)
    if (!record) return null
    const { encryptedKey, encryption, ...metadata } = record
    return { ...metadata, apiKey: this.decrypt(record) }
  }

  async saveKey(input: SaveApiKeyInput): Promise<MaskedApiKey[]> {
    const keys = await this.storedKeys()
    const current = input.id ? keys.find((key) => key.id === input.id) : undefined
    if (!current && !input.apiKey) throw new Error('API key is required')
    const normalizedKey = input.apiKey ? normalizeAccessKey(input.apiKey) : undefined
    if (input.apiKey && !normalizedKey) throw new Error('API key is empty after normalization')
    if (normalizedKey && /\s/.test(normalizedKey)) throw new Error('API key must not contain whitespace')
    const encrypted = normalizedKey ? this.encrypt(normalizedKey) : {
      encryptedKey: current!.encryptedKey,
      encryption: current!.encryption
    }
    const record: StoredKey = {
      id: current?.id || randomUUID(),
      label: input.label.trim(),
      status: input.status,
      note: input.note?.trim(),
      usedCount: current?.usedCount || 0,
      lastUsedAt: current?.lastUsedAt,
      creditBalance: current?.creditBalance,
      creditLoadedAt: current?.creditLoadedAt,
      creditError: current?.creditError,
      ...encrypted
    }
    await writeFile(path.join(this.configDir, 'keys.json'), JSON.stringify([record, ...keys.filter((key) => key.id !== record.id)], null, 2), 'utf8')
    return this.listKeys()
  }

  async deleteKey(id: string): Promise<MaskedApiKey[]> {
    const keys = await this.storedKeys()
    await writeFile(path.join(this.configDir, 'keys.json'), JSON.stringify(keys.filter((key) => key.id !== id), null, 2), 'utf8')
    return this.listKeys()
  }

  async markKeyUsed(id: string): Promise<void> {
    const keys = await this.storedKeys()
    const key = keys.find((item) => item.id === id)
    if (!key) return
    key.usedCount += 1
    key.lastUsedAt = new Date().toISOString()
    await writeFile(path.join(this.configDir, 'keys.json'), JSON.stringify(keys, null, 2), 'utf8')
  }

  async saveKeyCredit(id: string, balance: string): Promise<MaskedApiKey[]> {
    const keys = await this.storedKeys()
    const key = keys.find((item) => item.id === id)
    if (!key) throw new Error('API key not found')
    key.creditBalance = balance
    key.creditLoadedAt = new Date().toISOString()
    key.creditError = undefined
    await writeFile(path.join(this.configDir, 'keys.json'), JSON.stringify(keys, null, 2), 'utf8')
    return this.listKeys()
  }

  async saveKeyCreditError(id: string, error: string): Promise<MaskedApiKey[]> {
    const keys = await this.storedKeys()
    const key = keys.find((item) => item.id === id)
    if (!key) throw new Error('API key not found')
    key.creditBalance = undefined
    key.creditLoadedAt = new Date().toISOString()
    key.creditError = redactSecrets(error)
    await writeFile(path.join(this.configDir, 'keys.json'), JSON.stringify(keys, null, 2), 'utf8')
    return this.listKeys()
  }
}
