// The coding agents TheIsland follows. The id is what the relay gets with --agent and what each
// session carries (session.agent); the name is what the island and Settings show.
export const AGENT_NAMES = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  antigravity: 'Antigravity',
  cursor: 'Cursor',
  copilot: 'Copilot CLI'
}
export const AGENT_IDS = Object.keys(AGENT_NAMES)
// Agents whose permission prompts the island can answer (their PermissionRequest hook waits for it).
export const APPROVAL_AGENTS = ['claude', 'codex']

// The name for a tab or a heading: the agent's own when every session is from one agent.
export function agentsLabel(sessions) {
  const kinds = new Set(sessions.map((s) => s.agent || 'claude'))
  return kinds.size === 1 ? AGENT_NAMES[[...kinds][0]] : 'Agents'
}
