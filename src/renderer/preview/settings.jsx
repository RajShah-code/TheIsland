// Dev-only harness: renders the settings window in a normal browser tab with a fake settingsApi
// (settings-api.js, imported first because Settings reads window.settingsApi when it loads).
// ?update shows an available update, ?store the Microsoft Store build. Opened links are logged as
// window.opened.
import './settings-api'
import { createRoot } from 'react-dom/client'
import Settings from '../src/settings/Settings'
import '../src/settings/settings.css'

createRoot(document.getElementById('root')).render(<Settings />)
