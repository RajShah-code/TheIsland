// User settings in %APPDATA%\TheIsland\config.json. Secrets (the calendar URL) are encrypted
// with Windows DPAPI through Electron's safeStorage, so the file alone doesn't reveal them.
import fs from 'node:fs'
import path from 'node:path'
import { app, safeStorage } from 'electron'

const DEFAULTS = {
  approvalsEnabled: true,
  // How long the island waits for Allow/Deny before handing the prompt back to the terminal.
  approvalTimeoutSec: 120,
  calendarUrl: null
}

let cache = null

function file() {
  return path.join(app.getPath('userData'), 'config.json')
}

export function getConfig() {
  if (cache) return cache
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

export function setConfig(patch) {
  cache = { ...getConfig(), ...patch }
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(file(), JSON.stringify(cache, null, 2))
  return cache
}

export function setSecret(key, value) {
  if (value == null) return setConfig({ [key]: null })
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows encryption is not available')
  return setConfig({ [key]: safeStorage.encryptString(value).toString('base64') })
}

export function getSecret(key) {
  const v = getConfig()[key]
  if (!v) return null
  try {
    return safeStorage.decryptString(Buffer.from(v, 'base64'))
  } catch {
    return null
  }
}
