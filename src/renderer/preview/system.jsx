// Dev-only harness: renders the System tab with sample data in a normal browser tab.
import { createRoot } from 'react-dom/client'
import '../src/styles.css'
import { DEFAULT_SETTINGS } from '../../shared/settings-model.mjs'
import { SystemPanel } from '../src/components/System'

window.island = { system: (...a) => console.log('system', ...a) }
const system = {
  cpu: 23, ramUsed: 9.4 * 1024 ** 3, ramTotal: 16 * 1024 ** 3, gpu: 8,
  diskRead: 120 * 1024, diskWrite: 2.3 * 1024 ** 2, netDown: 1.4 * 1024 ** 2, netUp: 48 * 1024,
  audio: { available: true, volume: 42, muted: false },
  brightness: { available: true, value: 70 },
  radios: { wifi: true, bluetooth: false },
  quick: { airplane: false, hotspot: false, energySaver: false, nightLight: true, colorFilters: false, micAvailable: true, micMuted: false },
  outputs: [{ id: 'a', name: 'Speakers (Realtek(R) Audio)', default: true }, { id: 'b', name: 'Headphones (WH-1000XM4)', default: false }],
  keepAwake: false
}
const params = new URLSearchParams(location.search)
const settings = { ...DEFAULT_SETTINGS, system: { ...DEFAULT_SETTINGS.system, hidden: params.has('all') ? [] : ['airplane', 'hotspot', 'nightLight', 'accessibility', 'project', 'colorFilters', 'keyboard'], controlStyle: params.get('style') || 'icon' } }

createRoot(document.getElementById('root')).render(
  <div style={{ margin: 40, width: 680, padding: '14px 20px 18px', background: '#000', borderRadius: 30 }} className="font-sans text-white">
    <SystemPanel system={system} settings={settings} active />
  </div>
)
