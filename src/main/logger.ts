import { app } from 'electron'
import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { inspect } from 'node:util'

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

let logFile = ''

function formatValue(value: unknown): string {
  if (value instanceof Error) return value.stack || value.message
  if (typeof value === 'string') return value
  return inspect(value, { depth: 5, breakLength: 140 })
}

async function write(level: LogLevel, scope: string, values: unknown[]): Promise<void> {
  const line = `${new Date().toISOString()} [${level}] [${scope}] ${values.map(formatValue).join(' ')}`
  const output = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  output(line)
  if (!logFile) return
  try {
    await appendFile(logFile, `${line}\n`, 'utf8')
  } catch (error) {
    console.error('Failed to write Electron log file', error)
  }
}

export async function initializeLogger(): Promise<string> {
  const logsDir = path.join(app.getPath('userData'), 'logs')
  await mkdir(logsDir, { recursive: true })
  logFile = path.join(logsDir, 'main.log')
  await write('INFO', 'app', [`Starting ${app.getName()} ${app.getVersion()}`, `log=${logFile}`])
  return logFile
}

export const logger = {
  info: (scope: string, ...values: unknown[]): void => { void write('INFO', scope, values) },
  warn: (scope: string, ...values: unknown[]): void => { void write('WARN', scope, values) },
  error: (scope: string, ...values: unknown[]): void => { void write('ERROR', scope, values) },
  filePath: (): string => logFile
}
