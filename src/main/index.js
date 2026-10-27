import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app, globalShortcut, ipcMain, shell } from 'electron'
import { AGENT_IDS, bundledRelayPath, dataDir, installRelayFile, legacyDataDir } from '../shared/hooks-installer.mjs'
import { createClaudeHub } from './claude'
import { agentHooksStatus, installAgentHooks, offerAgentHooks, removeAgentHooks } from './claude-hooks'
import { startCalendar } from './calendar'
import { addCalendarFromClipboard } from './calendar-url'
import { getSettings, updateSettings } from './config'
import {
  accountsView,
  addAccount,
  KINDS,
  listAccounts,
  migrateCalendarAccounts,
  removeAccount,
  updateAccount
} from './calendars/accounts'
import * as googleCalendar from './calendars/google'
import * as microsoftCalendar from './calendars/microsoft'
import { goodbyeText, greetingText } from './greeting'
import { log } from './log'
import { startHelper } from './helper'
import { startRelayServer } from './relay-server'
import { createSettingsWindowManager } from './settings-window'
import { createTray } from './tray'
import { createPointerTracker } from './pointer'
import { startUpdateCheck } from './updates'
import { createIslandWindow } from './window'

// The Microsoft Store build (MSIX). Windows gives it its app ID and starts it at sign-in through the
// package's startup task (build/appx-extensions.xml), so the shortcut code below is skipped there.
const STORE = process.windowsStore === true

useDataDir()
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  if (!STORE) app.setAppUserModelId('TheIsland')
  // Smaller footprint: the island has no use for these.
  app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,MediaRouter')
  // A small 2D overlay doesn't need the GPU; software rendering saves ~100 MB.
  if (!process.env.ISLAND_GPU) app.disableHardwareAcceleration()
  app.whenReady().then(start)
}

// Keeps all data in %USERPROFILE%\.theisland (see dataDir() for why not %APPDATA%). Runs before the
// single instance lock, which lives in that folder too. The first time, the settings move over from
// the old folder with Chromium's "Local State", which holds the key the calendar address is
// encrypted with.
function useDataDir() {
  const dir = dataDir()
  try {
    if (!fs.existsSync(path.join(dir, 'config.json'))) {
      fs.mkdirSync(dir, { recursive: true })
      for (const name of ['config.json', 'Local State']) {
        const from = path.join(legacyDataDir(), name)
        if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dir, name))
      }
    }
  } catch {}
  app.setPath('userData', dir)
}

// Hides the whole island until pressed again (also in the tray menu).
const HIDE_SHORTCUT = 'Control+Alt+I'
const GREET_DELAY_MS = 1200
// The one-time offers to connect coding agents come after the greeting has had its moment.
const OFFER_DELAY_MS = 4000
const GOODBYE_MS = 1800

// Start with Windows, as a shortcut in the user's Startup folder. A Run registry entry (what Electron's
// login item writes) was never launched on this machine even with an "enabled" mark identical to
// Spotify's, which did run (Shell-Core log, 2026-10-22); Startup folder shortcuts go through a
// separate path that works. Run unpackaged (`electron .`), the shortcut must carry the app path.
const LOGIN_NAME = 'TheIsland'
const APPROVED_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved'
const startupShortcut = () =>
  path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', `${LOGIN_NAME}.lnk`)
function oldLoginItemOptions() {
  return { name: LOGIN_NAME, ...(app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] }) }
}
const regDelete = (key, value) => execFile('reg', ['delete', key, '/v', value, '/f'], () => {})
function startsWithWindows() {
  return !STORE && fs.existsSync(startupShortcut())
}
function setStartWithWindows(on) {
  if (STORE) return
  try {
    if (on) {
      const ok = shell.writeShortcutLink(startupShortcut(), {
        target: process.execPath,
        args: app.isPackaged ? '' : `"${app.getAppPath()}"`,
        cwd: app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(),
        appUserModelId: 'TheIsland',
        description: 'TheIsland'
      })
      if (!ok) throw new Error('shortcut not written')
      // The user's own switch also clears a "disabled" mark left by Task Manager (no mark = enabled).
      regDelete(`${APPROVED_KEY}\\StartupFolder`, `${LOGIN_NAME}.lnk`)
    } else {
      fs.rmSync(startupShortcut(), { force: true })
    }
    log(on ? 'start with windows on' : 'start with windows off')
  } catch (e) {
    log('could not change the login item', e.message)
  }
}
// Move a Run entry from an earlier version over to the shortcut.
function migrateLoginItem() {
  if (STORE) return
  try {
    if (!app.getLoginItemSettings(oldLoginItemOptions()).openAtLogin) return
    app.setLoginItemSettings({ ...oldLoginItemOptions(), openAtLogin: false })
    regDelete(`${APPROVED_KEY}\\Run`, LOGIN_NAME)
    setStartWithWindows(true)
    log('login item moved to the Startup folder')
  } catch (e) {
    log('could not move the login item', e.message)
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Windows Settings pages the System tab may open ("open <name>"). Nothing else reaches openExternal.
const SETTINGS_PAGES = {
  accessibility: 'ms-settings:easeofaccess',
  nearby: 'ms-settings:crossdevice',
  focus: 'ms-settings:quiethours',
  energy: 'ms-settings:batterysaver',
  nightlight: 'ms-settings:nightlight',
  display: 'ms-settings:display',
  sound: 'ms-settings:sound',
  network: 'ms-settings:network',
  bluetooth: 'ms-settings:bluetooth',
  settings: 'ms-settings:'
}

// Pages the settings window and the tray can open (About section, the update notice, and Windows'
// startup page for the Store build).
const WEBSITE = 'https://rajshah-code.github.io/TheIsland/'
const SETTINGS_LINKS = {
  website: WEBSITE,
  download: WEBSITE + 'download',
  privacy: WEBSITE + 'privacy',
  license: WEBSITE + 'license',
  help: WEBSITE + 'help',
  feedback: feedbackUrl('bug'),
  feedbackBug: feedbackUrl('bug'),
  feedbackIdea: feedbackUrl('idea'),
  startup: 'ms-settings:startupapps'
}

// The site's feedback form, with the kind picked and the version, Windows build and Store flag filled in.
function feedbackUrl(kind) {
  const q = new URLSearchParams({ kind, v: app.getVersion(), os: os.release() })
  if (STORE) q.set('store', '1')
  return `${WEBSITE}feedback?${q}`
}

function openLink(name) {
  // The data folder, so a bug report can attach the log. Nothing is uploaded.
  if (name === 'logs') return void shell.openPath(dataDir()).then((err) => err && log('could not open logs', err))
  if (typeof name !== 'string' || !Object.hasOwn(SETTINGS_LINKS, name)) return
  shell.openExternal(SETTINGS_LINKS[name]).catch((e) => log('could not open', name, e.message))
}

function openSettingsPage(name) {
  if (typeof name !== 'string' || !Object.hasOwn(SETTINGS_PAGES, name)) return
  shell.openExternal(SETTINGS_PAGES[name]).catch((e) => log('could not open', name, e.message))
}

function start() {
  log('starting')
  let win = null
  let hidden = false
  let tray = null
  let media = null
  let pointer = null
  // The renderer asks for System tab stats only while that tab is on screen; a hidden island never.
  let systemWanted = false
  const updateSystemWatch = () => media?.system.setWatch(systemWanted && !hidden)
  const send = (channel, data) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, data)
  }
  const setHidden = (on) => {
    hidden = on
    if (win && !win.isDestroyed()) {
      if (on) win.hide()
      else {
        win.showInactive()
        win.setAlwaysOnTop(true, 'screen-saver')
      }
    }
    updateSystemWatch()
    pointer?.setEnabled(!on)
    log(on ? 'island hidden' : 'island shown')
    tray?.refresh()
  }
  // Returns false when there is no visible island to say it on.
  let saidGoodbye = false
  const sayGoodbye = () => {
    if (hidden || !win || win.isDestroyed()) return false
    if (!saidGoodbye) send('island:attention', { kind: 'bye', text: goodbyeText() })
    saidGoodbye = true
    return true
  }

  migrateLoginItem()

  // Keep the copy the hooks run up to date with this version of the relay.
  try {
    installRelayFile(bundledRelayPath(app.getAppPath()))
  } catch (e) {
    log('could not copy relay', e.message)
  }

  const settingsWin = createSettingsWindowManager()
  const hub = createClaudeHub({
    getConfig: getSettings,
    closedHosts: (pids) => (media ? media.closedHosts(pids) : Promise.resolve(new Set())),
    onChange: (snap) => send('island:claude', snap),
    onAttention: (a) => {
      // An approval needs an answer, so it brings a hidden island back.
      if (hidden && a.kind === 'approval') setHidden(false)
      if (win && !win.isDestroyed()) win.setAlwaysOnTop(true, 'screen-saver')
      send('island:attention', a)
    }
  })
  const server = startRelayServer({ dir: app.getPath('userData'), onEvent: hub.handle })
  media = startHelper({
    onMedia: (m) => send('island:media', m),
    onFullscreen: (on) => send('island:fullscreen', on),
    onSystem: (s) => send('island:system', s)
  })
  // A Google sign-in wins over the iCal address when both are set.
  migrateCalendarAccounts()
  const calendar = startCalendar({
    getAccounts: () => listAccounts().filter((a) => a.enabled),
    onChange: (c) => {
      send('island:calendar', c)
      // The settings window shows each account's own error.
      if (settingsWin.isOpen()) settingsWin.send('settings:changed', settingsView())
    }
  })
  // The island gets the validated settings (no secrets). The settings window also gets a few facts it
  // shows: the real login item state, the calendar accounts (never their tokens or addresses) and the version.
  const settings = () => getSettings()
  const settingsView = () => {
    const s = getSettings()
    return {
      ...s,
      island: { ...s.island, startWithWindows: startsWithWindows() },
      store: STORE,
      calendar: {
        accounts: accountsView(calendar.get().errors),
        // Builds without the owner's OAuth client IDs (a fork, a local build) offer only what works.
        builtIn: { google: googleCalendar.hasBuiltInClient(), microsoft: microsoftCalendar.hasBuiltInClient() }
      },
      agentHooks: agentHooksStatus(),
      version: app.getVersion(),
      update: updates?.get() ?? null
    }
  }
  // One path for every change, from the tray or the settings window: apply, push live, sync both UIs.
  const settingsChanged = () => {
    if (!getSettings().approvalsEnabled) hub.releaseAll()
    send('island:settings', settings())
    if (settingsWin.isOpen()) settingsWin.send('settings:changed', settingsView())
    tray?.refresh()
  }
  const calendarChanged = () => {
    calendar.refresh()
    if (settingsWin.isOpen()) settingsWin.send('settings:changed', settingsView())
    tray?.refresh()
  }
  // The Store updates its own build; only the GitHub installer build looks for new releases.
  const updates = STORE
    ? null
    : startUpdateCheck({
        isEnabled: () => getSettings().updates.check,
        onChange: () => {
          if (settingsWin.isOpen()) settingsWin.send('settings:changed', settingsView())
          tray?.refresh()
        }
      })
  tray = createTray({
    onConfigChanged: settingsChanged,
    onCalendarChanged: calendarChanged,
    onOpenSettings: () => settingsWin.open(),
    isHidden: () => hidden,
    getUpdate: () => updates?.get() ?? null,
    onOpenDownload: () => openLink('download'),
    onOpenFeedback: () => openLink('feedback'),
    onToggleHidden: () => setHidden(!hidden),
    onQuit: () => {
      // Quit from the tray: show the goodbye for a moment first.
      if (!sayGoodbye()) return app.quit()
      setTimeout(() => app.quit(), GOODBYE_MS)
    },
    hideShortcut: HIDE_SHORTCUT
  })

  win = createIslandWindow()
  // Hello once the page is up (a moment later, so the island is on screen and listening).
  win.webContents.once('did-finish-load', () => {
    setTimeout(() => send('island:attention', { kind: 'greet', text: greetingText() }), GREET_DELAY_MS)
    setTimeout(() => offerAgentHooks().then((yes) => yes && settingsChanged()), OFFER_DELAY_MS)
  })
  // Windows is shutting down, restarting or signing out: say goodbye while it closes apps.
  win.on('query-session-end', () => sayGoodbye())
  win.on('session-end', () => log('windows session ending'))
  if (!globalShortcut.register(HIDE_SHORTCUT, () => setHidden(!hidden)))
    log('could not register', HIDE_SHORTCUT, '(another app has it)')
  const fromIsland = (e) => win && !win.isDestroyed() && e.sender === win.webContents
  // A reloading or crashed page can't say the System tab closed, so stop the stats for it.
  const dropSystemWatch = () => {
    systemWanted = false
    updateSystemWatch()
  }
  win.webContents.on('did-start-loading', dropSystemWatch)
  win.webContents.on('render-process-gone', dropSystemWatch)
  // Cursor polling instead of forwarded mouse moves (see pointer.js). A reloading or crashed page
  // starts out not interactive, so hand the mouse back for it too.
  pointer = createPointerTracker(win, (p) => send('island:pointer', p))
  if (hidden) pointer.setEnabled(false)
  const dropInteractive = () => pointer.setInteractive(false)
  win.webContents.on('did-start-loading', dropInteractive)
  win.webContents.on('render-process-gone', dropInteractive)
  win.on('closed', () => pointer.stop())

  ipcMain.handle('island:state', (e) =>
    fromIsland(e)
      ? {
          claude: hub.snapshot(),
          media: media.get(),
          calendar: calendar.get(),
          settings: settings(),
          fullscreen: media.isFullscreen(),
          system: media.system.get()
        }
      : null
  )
  ipcMain.handle('island:calendar-week', (e, start) => (fromIsland(e) ? calendar.week(Number(start)) : null))
  ipcMain.on('island:decide', (e, id, decision, answers) => {
    if (fromIsland(e) && typeof id === 'string') hub.decide(id, decision, answers)
  })
  ipcMain.on('island:media', (e, cmd) => {
    if (fromIsland(e)) media.command(cmd)
  })
  ipcMain.on('island:system', (e, cmd, value) => {
    if (!fromIsland(e) || typeof cmd !== 'string') return
    // Settings pages open here (only the whitelisted ones); everything else goes to the helper.
    if (cmd === 'open') return openSettingsPage(value)
    media.system.command(cmd, value)
  })
  ipcMain.on('island:system-watch', (e, on) => {
    if (!fromIsland(e)) return
    systemWanted = on === true
    updateSystemWatch()
  })
  ipcMain.on('island:interactive', (e, on) => {
    if (!fromIsland(e)) return
    pointer.setInteractive(on === true)
    if (on === true) calendar.touch()
  })
  ipcMain.on('island:open-settings', (e) => {
    if (fromIsland(e)) settingsWin.open()
  })

  // Settings window. Every handler checks the sender, so the island page can't call these.
  ipcMain.handle('settings:get', (e) => (settingsWin.isSender(e) ? settingsView() : null))
  ipcMain.handle('settings:set', (e, patch) => {
    if (!settingsWin.isSender(e) || !isPlainObject(patch)) return null
    const login = isPlainObject(patch.island) ? patch.island.startWithWindows : undefined
    if (typeof login === 'boolean' && login !== startsWithWindows()) setStartWithWindows(login)
    const checked = getSettings().updates.check
    updateSettings(patch)
    if (getSettings().updates.check !== checked) updates?.setEnabled(!checked)
    settingsChanged()
    return settingsView()
  })
  // With an address typed or pasted into the settings window, or without one to read the clipboard.
  // Calendar accounts. Secrets come in with an add and never go back out.
  ipcMain.handle('settings:calendar-add', async (e, kind, payload) => {
    if (!settingsWin.isSender(e) || !KINDS.includes(kind) || (payload != null && !isPlainObject(payload))) return null
    try {
      await addAccount(kind, payload)
    } catch (err) {
      if (!err.user) log('calendar add failed:', kind, err.message)
      return { ok: false, error: err.user ? err.message : 'Something went wrong: ' + err.message, view: settingsView() }
    }
    calendarChanged()
    return { ok: true, error: null, view: settingsView() }
  })
  ipcMain.handle('settings:calendar-update', (e, id, patch) => {
    if (!settingsWin.isSender(e) || typeof id !== 'string' || !isPlainObject(patch)) return null
    updateAccount(id, patch)
    calendarChanged()
    return settingsView()
  })
  ipcMain.handle('settings:calendar-remove', async (e, id) => {
    if (!settingsWin.isSender(e) || typeof id !== 'string') return null
    await removeAccount(id)
    calendarChanged()
    return settingsView()
  })
  // Setup pages for the calendar forms, by name only.
  ipcMain.on('settings:open-calendar-help', (e, name) => {
    const pages = {
      googleConsole: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
      appleAppPasswords: 'https://account.apple.com/account/manage/section/security',
      notionIntegrations: 'https://www.notion.so/profile/integrations'
    }
    if (settingsWin.isSender(e) && Object.hasOwn(pages, name)) shell.openExternal(pages[name])
  })
  // Fixed pages only: the settings window names one, it never passes an address.
  ipcMain.on('settings:open-link', (e, name) => {
    if (settingsWin.isSender(e)) openLink(name)
  })
  // Coding agent hooks: the main process shows the change in a dialog on the settings window first.
  ipcMain.handle('settings:agent-hooks', async (e, agent, action) => {
    if (!settingsWin.isSender(e) || !AGENT_IDS.includes(agent)) return null
    if (action === 'install') await installAgentHooks(agent, { parent: settingsWin.get() })
    else if (action === 'remove') await removeAgentHooks(agent, { parent: settingsWin.get() })
    settingsChanged()
    return settingsView()
  })

  app.on('before-quit', () => {
    globalShortcut.unregisterAll()
    hub.releaseAll()
    server.close()
    media.stop()
    updates?.stop()
    pointer?.stop()
    tray.destroy()
    log('quit')
  })
  app.on('window-all-closed', () => app.quit())
}
