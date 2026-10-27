// The calendar accounts: Google, Outlook, CalDAV (iCloud), iCal links and Notion databases, any number
// of each. config.json keeps the non-secret part of each one ({ id, kind, label, color, enabled, meta })
// in `calendarAccounts`; its tokens, passwords and addresses are one DPAPI-encrypted JSON value under
// `calendarSecret:<id>`. Nothing secret is ever sent to a renderer.
import crypto from 'node:crypto'
import { CALENDAR_COLORS as COLORS } from '../../shared/settings-model.mjs'
import { getConfig, getSecret, setConfig, setSecret } from '../config'
import { log } from '../log'
import * as caldav from './caldav'
import * as google from './google'
import * as ics from './ics'
import * as microsoft from './microsoft'
import * as notion from './notion'

export const PROVIDERS = { google, microsoft, caldav, ics, notion }
export const KINDS = Object.keys(PROVIDERS)

const secretKey = (id) => `calendarSecret:${id}`

export function listAccounts() {
  const list = getConfig().calendarAccounts
  return Array.isArray(list) ? list : []
}

function save(list) {
  setConfig({ calendarAccounts: list })
}

export function readSecrets(id) {
  const s = getSecret(secretKey(id))
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

export function saveSecrets(id, patch) {
  setSecret(secretKey(id), JSON.stringify({ ...(readSecrets(id) || {}), ...patch }))
}

// What a provider gets: the account's own data and a way to update its secrets (rotated tokens).
export function context(account) {
  return {
    id: account.id,
    meta: account.meta || {},
    secrets: () => readSecrets(account.id),
    saveSecrets: (patch) => saveSecrets(account.id, patch)
  }
}

// Connects with the provider (sign-in, or a check of the address or token) and saves the account.
export async function addAccount(kind, payload) {
  const provider = PROVIDERS[kind]
  if (!provider) throw new Error('unknown calendar kind')
  const { label, meta, secrets } = await provider.connect(payload || {})
  const list = listAccounts()
  const account = {
    id: crypto.randomBytes(6).toString('hex'),
    kind,
    label,
    color: COLORS[list.length % COLORS.length],
    enabled: true,
    meta
  }
  setSecret(secretKey(account.id), JSON.stringify(secrets))
  save([...list, account])
  return account
}

// Only the label, colour and on/off switch can change from Settings.
export function updateAccount(id, patch) {
  if (!patch || typeof patch !== 'object') return
  save(
    listAccounts().map((a) => {
      if (a.id !== id) return a
      const next = { ...a }
      if (typeof patch.label === 'string' && patch.label.trim()) next.label = patch.label.trim().slice(0, 60)
      if (COLORS.includes(patch.color)) next.color = patch.color
      if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled
      return next
    })
  )
}

export async function removeAccount(id) {
  const account = listAccounts().find((a) => a.id === id)
  if (!account) return
  try {
    await PROVIDERS[account.kind]?.disconnect(context(account))
  } catch {}
  setConfig({ [secretKey(id)]: null })
  save(listAccounts().filter((a) => a.id !== id))
  log('calendar removed:', account.kind)
}

// Older versions had one Google sign-in (its own client) and one iCal address. The first start of this
// version turns them into accounts, then clears the old keys.
export function migrateCalendarAccounts() {
  const cfg = getConfig()
  if (Array.isArray(cfg.calendarAccounts)) return
  const list = []
  const add = (kind, label, meta, secrets) => {
    const id = crypto.randomBytes(6).toString('hex')
    setSecret(secretKey(id), JSON.stringify(secrets))
    list.push({ id, kind, label, color: COLORS[list.length % COLORS.length], enabled: true, meta })
  }
  try {
    const refreshToken = getSecret('googleRefreshToken')
    if (refreshToken) {
      add('google', 'Google', { ownClient: true }, {
        refreshToken,
        clientId: getSecret('googleClientId'),
        clientSecret: getSecret('googleClientSecret')
      })
    }
    const url = getSecret('calendarUrl')
    if (url) add('ics', 'iCal calendar', {}, { url })
  } catch (e) {
    log('calendar migration failed:', e.message)
    return
  }
  setConfig({ calendarAccounts: list, calendarUrl: null, googleClientId: null, googleClientSecret: null, googleRefreshToken: null })
  if (list.length) log('calendar settings moved to accounts:', list.length)
}

// The parts of each account the settings window shows.
export function accountsView(status = {}) {
  return listAccounts().map((a) => ({
    id: a.id,
    kind: a.kind,
    label: a.label,
    color: a.color,
    enabled: a.enabled,
    ownClient: !!a.meta?.ownClient,
    error: status[a.id] || null
  }))
}
