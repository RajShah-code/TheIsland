// Plays a short, realistic session of a coding agent into the running island, through the real relay exe
// with the same arguments and payload shape that agent's hooks use. For trying agents you don't have.
//
//   npm run agents:demo                      every agent, one after the other
//   npm run agents:demo -- codex gemini      just these
//   npm run agents:demo -- --home <folder>   an island started with USERPROFILE=<folder>
//
// Codex ends with a permission request: answer it in the island (or wait for the timeout). The others
// show "Needs you" for a moment, then finish.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const exe = path.join(root, 'resources', 'theisland-relay.exe')
const args = process.argv.slice(2)
const hi = args.indexOf('--home')
const home = hi >= 0 ? path.resolve(args[hi + 1]) : process.env.USERPROFILE
const picked = args.filter((a, i) => !a.startsWith('--') && i !== hi + 1)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function relay(agentArgs, event) {
  return new Promise((resolve) => {
    const p = spawn(exe, ['--hook', ...agentArgs], { env: { ...process.env, USERPROFILE: home }, windowsHide: true })
    let out = ''
    p.stdout.on('data', (c) => (out += c))
    p.on('close', () => resolve(out))
    p.stdin.end(JSON.stringify(event))
  })
}

// Each step: [event name, payload]. The name goes in the payload or in --event, as each agent does it.
const cwd = (name) => `D:/demo/${name}`
const SESSIONS = {
  codex: {
    args: ['--agent', 'codex'],
    steps: (id) => [
      ['SessionStart', { session_id: id, cwd: cwd('codex-app'), model: 'gpt-5-codex' }],
      ['UserPromptSubmit', { session_id: id, prompt: 'fix the failing test' }],
      ['PreToolUse', { session_id: id, tool_name: 'shell', tool_input: { command: 'npm test' } }],
      ['PostToolUse', { session_id: id, tool_name: 'shell', tool_input: { command: 'npm test' } }],
      ['PermissionRequest', { session_id: id, tool_name: 'shell', tool_input: { command: 'git push origin demo' } }],
      ['Stop', { session_id: id }]
    ]
  },
  gemini: {
    args: ['--agent', 'gemini'],
    steps: (id) => [
      ['SessionStart', { session_id: id, cwd: cwd('gemini-site') }],
      ['BeforeAgent', { session_id: id, prompt: 'add a footer' }],
      ['BeforeTool', { session_id: id, tool_name: 'read_file', tool_input: { file_path: 'D:/demo/gemini-site/index.html' } }],
      ['AfterTool', { session_id: id, tool_name: 'read_file' }],
      ['Notification', { session_id: id, notification_type: 'ToolPermission', message: 'Allow write_file?' }],
      ['BeforeTool', { session_id: id, tool_name: 'write_file', tool_input: { file_path: 'D:/demo/gemini-site/index.html' } }],
      ['AfterAgent', { session_id: id }]
    ]
  },
  antigravity: {
    eventArg: true,
    args: ['--agent', 'antigravity'],
    steps: (id) => [
      ['PreInvocation', { conversationId: id, workspacePaths: [cwd('agy-game')] }],
      ['PostToolUse', { conversationId: id, workspacePaths: [cwd('agy-game')], toolCall: { name: 'list_dir', args: { DirectoryPath: 'D:/demo/agy-game' } } }],
      ['PostToolUse', { conversationId: id, workspacePaths: [cwd('agy-game')], toolCall: { name: 'run_command', args: { CommandLine: 'npm run build' } } }],
      ['Stop', { conversationId: id, workspacePaths: [cwd('agy-game')], fullyIdle: true }]
    ]
  },
  cursor: {
    args: ['--agent', 'cursor'],
    steps: (id) => [
      ['beforeSubmitPrompt', { conversation_id: id, workspace_roots: [cwd('cursor-api')], prompt: 'rename the route' }],
      ['afterFileEdit', { conversation_id: id, workspace_roots: [cwd('cursor-api')], file_path: 'D:/demo/cursor-api/routes.js' }],
      ['afterShellExecution', { conversation_id: id, workspace_roots: [cwd('cursor-api')], command: 'npm run lint' }],
      ['stop', { conversation_id: id, workspace_roots: [cwd('cursor-api')], status: 'completed' }]
    ]
  },
  copilot: {
    eventArg: true,
    args: ['--agent', 'copilot'],
    steps: () => [
      ['sessionStart', { cwd: cwd('copilot-cli') }],
      ['userPromptSubmitted', { cwd: cwd('copilot-cli'), prompt: 'explain this repo' }],
      ['preToolUse', { cwd: cwd('copilot-cli'), toolName: 'bash', toolArgs: '{"command":"git log --oneline -5"}' }],
      ['postToolUse', { cwd: cwd('copilot-cli'), toolName: 'bash', toolArgs: '{"command":"git log --oneline -5"}' }],
      ['agentStop', { cwd: cwd('copilot-cli') }]
    ]
  }
}

const agents = picked.length ? picked : Object.keys(SESSIONS)
for (const agent of agents) {
  const s = SESSIONS[agent]
  if (!s) {
    console.log(`Unknown agent "${agent}". One of: ${Object.keys(SESSIONS).join(', ')}`)
    continue
  }
  const id = `demo-${agent}-${Date.now().toString(36)}`
  console.log(`${agent}:`)
  for (const [name, payload] of s.steps(id)) {
    const event = s.eventArg ? payload : { hook_event_name: name, ...payload }
    if (name === 'PermissionRequest') console.log('  PermissionRequest: answer it in the island...')
    const out = await relay(s.eventArg ? [...s.args, '--event', name] : s.args, event)
    console.log(`  ${name}${out ? '  -> ' + out.trim() : ''}`)
    await wait(1500)
  }
}
