// CLI for the Claude Code hook installer.
//
//   npm run hooks:diff        show what install would change (writes nothing)
//   npm run hooks:install     show the diff, then install (asks y/N unless --yes)
//   npm run hooks:uninstall   remove only TheIsland's hook entries
//   npm run hooks:status
//
// --settings <path> targets another file (used for testing).
import { createInterface } from 'node:readline/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyPlan,
  defaultSettingsPath,
  installRelayFile,
  isInstalled,
  planInstall,
  planUninstall,
  relayInstallPath
} from '../src/shared/hooks-installer.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const cmd = args[0]
const yes = args.includes('--yes')
const si = args.indexOf('--settings')
const settingsPath = si >= 0 ? args[si + 1] : defaultSettingsPath()
// Hooks run with the system Node, not Electron.
const nodePath = process.execPath

function showDiff(p) {
  if (!p.changed) {
    console.log('No changes needed for ' + p.file)
    return
  }
  console.log('Changes to ' + p.file + ':\n')
  // Only changed lines and a little context.
  const lines = p.diff.split('\n')
  const keep = new Set()
  lines.forEach((l, i) => {
    if (!l.startsWith('  ')) for (let k = i - 2; k <= i + 2; k++) keep.add(k)
  })
  let last = -1
  lines.forEach((l, i) => {
    if (!keep.has(i)) return
    if (last >= 0 && i !== last + 1) console.log('  ...')
    console.log(l)
    last = i
  })
  console.log('')
}

async function confirm(q) {
  if (yes) return true
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const a = await rl.question(q + ' [y/N] ')
  rl.close()
  return a.trim().toLowerCase() === 'y'
}

try {
  if (cmd === 'diff' || cmd === 'install') {
    const p = planInstall({ settingsPath, nodePath, relayPath: relayInstallPath() })
    showDiff(p)
    if (cmd === 'install' && p.changed) {
      if (!(await confirm('Write these changes?'))) {
        console.log('Nothing written.')
        process.exit(0)
      }
      installRelayFile(join(root, 'hook', 'theisland-relay.cjs'))
      const r = applyPlan(p)
      console.log('Installed. Backup: ' + (r.backup || '(file was new)'))
    }
  } else if (cmd === 'uninstall') {
    const p = planUninstall({ settingsPath })
    showDiff(p)
    if (p.changed) {
      if (!(await confirm('Remove TheIsland hooks?'))) process.exit(0)
      const r = applyPlan(p)
      console.log('Removed. Backup: ' + r.backup)
    }
  } else if (cmd === 'status') {
    console.log(isInstalled(settingsPath) ? 'Installed in ' + settingsPath : 'Not installed in ' + settingsPath)
  } else {
    console.log('Usage: node scripts/hooks.mjs <diff|install|uninstall|status> [--yes] [--settings <path>]')
  }
} catch (e) {
  console.error('Refused: ' + e.message)
  process.exit(1)
}
