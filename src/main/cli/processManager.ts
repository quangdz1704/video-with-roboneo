import { spawn, type ChildProcess } from 'node:child_process'

export interface CommandResult {
  code: number
  stdout: string
  stderr: string
}

export class ProcessManager {
  private processes = new Map<string, ChildProcess>()

  run(
    jobId: string,
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    onData?: (stream: 'stdout' | 'stderr', chunk: string) => void
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      this.processes.set(jobId, child)
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString()
        stdout += chunk
        onData?.('stdout', chunk)
      })
      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString()
        stderr += chunk
        onData?.('stderr', chunk)
      })
      child.on('error', (error) => {
        this.processes.delete(jobId)
        reject(error)
      })
      child.on('close', (code) => {
        this.processes.delete(jobId)
        resolve({ code: code ?? -1, stdout, stderr })
      })
    })
  }

  cancel(jobId: string): boolean {
    const child = this.processes.get(jobId)
    if (!child) return false
    child.kill('SIGTERM')
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
    }, 1500).unref()
    return true
  }
}
