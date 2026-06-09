import { app, BrowserWindow, net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { LocalProjectStorage } from './storage/localProjectStorage'
import { ProcessManager } from './cli/processManager'
import { RoboNeoRunner } from './cli/roboneoRunner'
import { registerIpc } from './ipc'
import { initializeLogger, logger } from './logger'

let mainWindow: BrowserWindow | null = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'roboneo-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
])

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#09090b',
    title: 'RoboNeo TikTok Video Studio',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const scope = `renderer:${path.basename(sourceId || 'unknown')}:${line}`
    if (level >= 3) logger.error(scope, message)
    else if (level === 2) logger.warn(scope, message)
    else logger.info(scope, message)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('renderer', 'Render process gone', details)
  })
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error('renderer', 'Failed to load', { errorCode, errorDescription, validatedURL })
  })
  mainWindow.on('unresponsive', () => logger.warn('window', 'Main window is unresponsive'))

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await initializeLogger()
  process.on('uncaughtException', (error) => logger.error('main:uncaughtException', error))
  process.on('unhandledRejection', (reason) => logger.error('main:unhandledRejection', reason))
  const storage = new LocalProjectStorage()
  await storage.init()
  protocol.handle('roboneo-asset', async (request) => {
    const filePath = new URL(request.url).searchParams.get('path')
    if (!filePath || !(await storage.canReadAsset(filePath))) {
      return new Response('Asset not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
  const runner = new RoboNeoRunner(storage, new ProcessManager(), () => mainWindow)
  registerIpc(storage, runner)
  await createWindow()
  logger.info('app', 'Main window ready')
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
}).catch((error) => logger.error('app:startup', error))

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
