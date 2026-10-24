// Compiles the two small Windows programs with the C# compiler that ships with Windows (.NET Framework 4).
// No .NET SDK or other toolchain needed.
//   helper/IslandHelper.cs    -> resources/island-helper.exe    (media sessions, fullscreen, system tab)
//   hook/TheIslandRelay.cs    -> resources/theisland-relay.exe  (the Claude Code hook relay)
// Skips a build when the exe is newer than its source (--force always builds).
// --out <dir> builds somewhere else, for example to test while the app holds the exes in resources/.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outArg = process.argv.indexOf('--out')
const outDir = outArg > 0 && process.argv[outArg + 1] ? resolve(process.argv[outArg + 1]) : join(root, 'resources')
const windir = process.env.WINDIR || 'C:\\Windows'
const fw = join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319')
const winmd = join(windir, 'System32', 'WinMetadata')
const csc = join(fw, 'csc.exe')

const targets = [
  {
    src: join(root, 'helper', 'IslandHelper.cs'),
    exe: 'island-helper.exe',
    refs: [
      join(fw, 'System.Runtime.dll'),
      join(fw, 'System.Runtime.InteropServices.WindowsRuntime.dll'),
      join(winmd, 'Windows.Foundation.winmd'),
      join(winmd, 'Windows.Media.winmd'),
      join(winmd, 'Windows.Storage.winmd'),
      join(winmd, 'Windows.Devices.winmd'),
      join(winmd, 'Windows.Networking.winmd'),
      join(winmd, 'Windows.System.winmd'),
      join(fw, 'System.Management.dll')
    ],
    missing: 'Music and fullscreen detection will be disabled.'
  },
  {
    src: join(root, 'hook', 'TheIslandRelay.cs'),
    exe: 'theisland-relay.exe',
    refs: [],
    missing: 'Claude Code hooks can not be installed.'
  }
]

if (process.platform !== 'win32') process.exit(0)
if (!existsSync(csc)) {
  console.error('[build-helper] csc.exe not found at ' + csc + '. ' + targets.map((t) => t.missing).join(' '))
  process.exit(0)
}

mkdirSync(outDir, { recursive: true })
for (const t of targets) {
  const out = join(outDir, t.exe)
  if (existsSync(out) && statSync(out).mtimeMs > statSync(t.src).mtimeMs && !process.argv.includes('--force')) continue
  execFileSync(
    csc,
    ['-nologo', '-optimize+', '-target:winexe', '-out:' + out, ...t.refs.map((r) => '-r:' + r), t.src],
    { stdio: 'inherit' }
  )
  console.log('[build-helper] built ' + out)
}
