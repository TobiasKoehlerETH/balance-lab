import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { SerialManager } from './serial'

const isDev = process.env['NODE_ENV'] === 'development'

let serialManager: SerialManager | null = null
let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#060608',
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  win.setMenuBarVisibility(false)

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  mainWindow = createWindow()

  serialManager = new SerialManager(mainWindow.webContents)
  serialManager.start()

  // Re-send connection status once the renderer has mounted and registered its IPC listeners
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => serialManager?.resendStatus(), 300)
  })

  ipcMain.handle('tare', () => { serialManager?.sendTare() })
  ipcMain.handle('connect', () => { serialManager?.connectNow() })

  ipcMain.handle('window:minimize', () => { mainWindow?.minimize() })
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => { mainWindow?.close() })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  serialManager?.stop()
  if (process.platform !== 'darwin') app.quit()
})
