import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import type { ChatAttachment, LogEntry, StoredChatMessage } from '../../shared/types'

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export class LocalStudioDatabase {
  private root = path.join(os.homedir(), 'RoboNeoTikTokStudio')
  private dbPath = path.join(this.root, 'studio.sqlite')
  private SQL?: SqlJsStatic
  private db?: Database
  private writeQueue = Promise.resolve()

  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true })
    this.SQL = await initSqlJs({
      locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`)
    })
    let bytes: Uint8Array | undefined
    try {
      bytes = new Uint8Array(await readFile(this.dbPath))
    } catch {
      bytes = undefined
    }
    this.db = bytes ? new this.SQL.Database(bytes) : new this.SQL.Database()
    this.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        stream TEXT NOT NULL,
        message TEXT NOT NULL,
        step TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_logs_project_time ON logs(project_id, timestamp);
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        room_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments_json TEXT NOT NULL DEFAULT '[]',
        raw_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_project_time ON chat_messages(project_id, created_at);
    `)
    await this.persist()
  }

  async addLog(entry: LogEntry): Promise<void> {
    this.exec(
      'INSERT OR REPLACE INTO logs (id, project_id, timestamp, stream, message, step) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.id, entry.projectId, entry.timestamp, entry.stream, entry.message, entry.step || null]
    )
    await this.enqueuePersist()
  }

  async listLogs(projectId: string, limit = 3000): Promise<LogEntry[]> {
    const rows = this.select(
      'SELECT id, project_id, timestamp, stream, message, step FROM logs WHERE project_id = ? ORDER BY timestamp ASC LIMIT ?',
      [projectId, limit]
    )
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      timestamp: String(row.timestamp),
      stream: row.stream as LogEntry['stream'],
      message: String(row.message),
      step: row.step ? String(row.step) as LogEntry['step'] : undefined
    }))
  }

  async addChatMessage(input: Omit<StoredChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<StoredChatMessage> {
    const message: StoredChatMessage = {
      ...input,
      id: input.id || randomUUID(),
      attachments: input.attachments || [],
      createdAt: input.createdAt || new Date().toISOString()
    }
    this.exec(
      'INSERT OR REPLACE INTO chat_messages (id, project_id, room_id, role, content, attachments_json, raw_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        message.id,
        message.projectId,
        message.roomId || null,
        message.role,
        message.content,
        JSON.stringify(message.attachments),
        message.raw === undefined ? null : JSON.stringify(message.raw),
        message.createdAt
      ]
    )
    await this.enqueuePersist()
    return message
  }

  async listChatMessages(projectId: string, limit = 1000): Promise<StoredChatMessage[]> {
    const rows = this.select(
      'SELECT id, project_id, room_id, role, content, attachments_json, raw_json, created_at FROM chat_messages WHERE project_id = ? ORDER BY created_at ASC LIMIT ?',
      [projectId, limit]
    )
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      roomId: row.room_id ? String(row.room_id) : undefined,
      role: row.role as StoredChatMessage['role'],
      content: String(row.content),
      attachments: safeJsonParse<ChatAttachment[]>(row.attachments_json as string, []),
      raw: safeJsonParse<unknown>(row.raw_json as string, undefined),
      createdAt: String(row.created_at)
    }))
  }

  private exec(sql: string, params: unknown[] = []): void {
    if (!this.db) throw new Error('Studio database is not initialized')
    if (params.length) {
      const statement = this.db.prepare(sql)
      try {
        statement.run(params)
      } finally {
        statement.free()
      }
      return
    }
    this.db.exec(sql)
  }

  private select(sql: string, params: unknown[] = []): Record<string, unknown>[] {
    if (!this.db) throw new Error('Studio database is not initialized')
    const statement = this.db.prepare(sql)
    try {
      statement.bind(params)
      const rows: Record<string, unknown>[] = []
      while (statement.step()) rows.push(statement.getAsObject())
      return rows
    } finally {
      statement.free()
    }
  }

  private enqueuePersist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this.persist())
    return this.writeQueue
  }

  private async persist(): Promise<void> {
    if (!this.db) throw new Error('Studio database is not initialized')
    await writeFile(this.dbPath, Buffer.from(this.db.export()))
  }
}
