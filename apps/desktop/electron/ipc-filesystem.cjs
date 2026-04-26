const { ipcMain, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const FILTERED_NAMES = new Set(['.git', 'node_modules', '.DS_Store'])

function assertAbsolutePath(p) {
  if (typeof p !== 'string' || (!p.startsWith('/') && !/^[a-zA-Z]:[/\\]/.test(p))) {
    throw new Error('Path must be absolute')
  }
}

function registerFilesystemIPC() {
  ipcMain.handle('orchestra:fs:readDir', (_event, dirPath) => {
    assertAbsolutePath(dirPath)
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries
        .filter((e) => !FILTERED_NAMES.has(e.name))
        .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        })
    } catch {
      return []
    }
  })

  ipcMain.handle('orchestra:fs:stat', (_event, filePath) => {
    assertAbsolutePath(filePath)
    const stats = fs.statSync(filePath)
    return { size: stats.size, mtime: stats.mtimeMs, isDirectory: stats.isDirectory() }
  })

  ipcMain.handle('orchestra:fs:readFile', (_event, filePath) => {
    assertAbsolutePath(filePath)
    const buffer = fs.readFileSync(filePath)
    const scanLength = Math.min(buffer.length, 8192)
    for (let i = 0; i < scanLength; i++) {
      if (buffer[i] === 0x00) {
        return { content: '', isBinary: true }
      }
    }
    if (buffer.length > 5 * 1024 * 1024) {
      return { content: '', isBinary: false, tooLarge: true }
    }
    return { content: buffer.toString('utf-8'), isBinary: false }
  })

  ipcMain.handle('orchestra:fs:writeFile', (_event, filePath, content) => {
    assertAbsolutePath(filePath)
    if (fs.statSync(filePath).isDirectory()) {
      throw new Error('Cannot write to a directory')
    }
    fs.writeFileSync(filePath, content, 'utf-8')
  })

  ipcMain.handle('orchestra:fs:deletePath', async (_event, filePath) => {
    assertAbsolutePath(filePath)
    try {
      await shell.trashItem(filePath)
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        throw err
      }
    }
  })

  ipcMain.handle('orchestra:fs:gitStatus', (_event, worktreePath) => {
    assertAbsolutePath(worktreePath)
    try {
      const output = execSync('git status --porcelain', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const result = {}
      for (const line of output.split('\n')) {
        if (!line) continue
        const xy = line.substring(0, 2)
        const rest = line.substring(3)
        if (xy.trim().startsWith('R')) {
          const arrowIndex = rest.indexOf(' -> ')
          if (arrowIndex !== -1) {
            const newName = rest.substring(arrowIndex + 4)
            result[newName] = 'R'
            continue
          }
        }
        result[rest] = xy.trim()
      }
      return result
    } catch {
      return {}
    }
  })
}

module.exports = { registerFilesystemIPC }
