// Tiny size-capped log in %APPDATA%\TheIsland\island.log (rotates to island.log.1).
// Lifecycle and errors only: never prompt text, commands, URLs or tokens.
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const MAX = 256 * 1024
let file = null

function target() {
  if (!file) file = path.join(app.getPath('userData'), 'island.log')
  return file
}

export function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.map(String).join(' ')}\n`
  try {
    const f = target()
    try {
      if (fs.statSync(f).size > MAX) fs.renameSync(f, f + '.1')
    } catch {}
    fs.appendFileSync(f, line)
  } catch {}
  if (!app.isPackaged) process.stdout.write(line)
}
