// Dev-only harness: renders Claude Code question cards (AskUserQuestion) in a normal browser tab.
// ?multi shows two questions, one of them multi-select. Answers are logged as window.answers.
import { createRoot } from 'react-dom/client'
import '../src/styles.css'
import { ApprovalCard } from '../src/components/Claude'
import { IslandProvider } from '../src/store'

const one = [
  {
    question: 'Every commit shows your email, which anyone can read once the repo is public. Swap it for your private GitHub no-reply address before pushing?',
    header: 'Your email',
    multiSelect: false,
    options: [
      { label: 'Use no-reply (Recommended)', description: 'Rewrite the local commits to the no-reply address. Commits still show as yours on GitHub.' },
      { label: 'Keep my Gmail', description: 'Push as is. Your Gmail address will be visible in the public history.' }
    ]
  }
]
const multi = [
  {
    question: 'Which framework should the settings page use?',
    header: 'Framework',
    multiSelect: false,
    options: [
      { label: 'React', description: 'Same as the island' },
      { label: 'Plain HTML', description: 'No build step' },
      { label: 'Svelte', description: 'Smaller bundle' }
    ]
  },
  {
    question: 'Which widgets should be on by default?',
    header: 'Widgets',
    multiSelect: true,
    options: [{ label: 'Music' }, { label: 'Clock' }, { label: 'Calendar', description: 'Needs a calendar address' }, { label: 'Weather' }]
  }
]

const params = new URLSearchParams(location.search)
const approval = {
  id: 'a1',
  sessionId: 's',
  project: 'TheIsland',
  tool: 'AskUserQuestion',
  input: { questions: params.has('multi') ? multi : one },
  expiresAt: Date.now() + 120000
}
const noop = () => () => {}
window.answers = []
window.island = {
  getState: () => Promise.resolve({}),
  onClaude: noop, onMedia: noop, onCalendar: noop, onSettings: noop, onFullscreen: noop, onSystem: noop,
  decide: (id, decision, answers) => window.answers.push({ id, decision, answers })
}

createRoot(document.getElementById('root')).render(
  <IslandProvider>
    {/* Same frame as the island's Claude Code tab: 600 px wide including 20 px padding (CLAUDE_W, PAD in App.jsx). */}
    <div style={{ margin: 40, width: 600, boxSizing: 'border-box', padding: 20, background: '#000', borderRadius: 30 }} className="font-sans text-white">
      <ApprovalCard approval={approval} queued={0} active />
    </div>
  </IslandProvider>
)
