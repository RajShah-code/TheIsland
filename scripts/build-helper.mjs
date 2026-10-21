// Compiles helper/IslandHelper.cs into resources/island-helper.exe using the C# compiler
// that ships with Windows (.NET Framework 4). No .NET SDK or other toolchain needed.
// Skips the build when the exe is newer than the source (--force always builds).
// --out <path> builds somewhere else, for example to test while the app holds resources/island-helper.exe.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'helper', 'IslandHelper.cs')
const outArg = process.argv.indexOf('--out')
const out = outArg > 0 && process.argv[outArg + 1] ? resolve(process.argv[outArg + 1]) : join(root, 'resources', 'island-helper.exe')
const windir = process.env.WINDIR || 'C:\\Windows'
const fw = join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319')
const winmd = join(windir, 'System32', 'WinMetadata')
const csc = join(fw, 'csc.exe')

if (process.platform !== 'win32') process.exit(0)
if (existsSync(out) && statSync(out).mtimeMs > statSync(src).mtimeMs && !process.argv.includes('--force')) {
  process.exit(0)
}
if (!existsSync(csc)) {
  console.error('[build-helper] csc.exe not found at ' + csc + '. Music and fullscreen detection will be disabled.')
  process.exit(0)
}

mkdirSync(dirname(out), { recursive: true })
execFileSync(
  csc,
  [
    '-nologo',
    '-optimize+',
    '-target:winexe',
    '-out:' + out,
    '-r:' + join(fw, 'System.Runtime.dll'),
    '-r:' + join(fw, 'System.Runtime.InteropServices.WindowsRuntime.dll'),
    '-r:' + join(winmd, 'Windows.Foundation.winmd'),
    '-r:' + join(winmd, 'Windows.Media.winmd'),
    '-r:' + join(winmd, 'Windows.Storage.winmd'),
    '-r:' + join(winmd, 'Windows.Devices.winmd'),
    '-r:' + join(winmd, 'Windows.Networking.winmd'),
    '-r:' + join(winmd, 'Windows.System.winmd'),
    '-r:' + join(fw, 'System.Management.dll'),
    src
  ],
  { stdio: 'inherit' }
)
console.log('[build-helper] built ' + out)
