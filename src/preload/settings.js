// Preload for the settings window only. The main process accepts these channels only from that
// window's webContents.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  calendarAdd: (kind, payload) => ipcRenderer.invoke('settings:calendar-add', kind, payload),
  calendarUpdate: (id, patch) => ipcRenderer.invoke('settings:calendar-update', id, patch),
  calendarRemove: (id) => ipcRenderer.invoke('settings:calendar-remove', id),
  openCalendarHelp: (name) => ipcRenderer.send('settings:open-calendar-help', name),
  openLink: (name) => ipcRenderer.send('settings:open-link', name),
  agentHooks: (agent, action) => ipcRenderer.invoke('settings:agent-hooks', agent, action),
  onChange: (cb) => {
    const fn = (_e, data) => cb(data)
    ipcRenderer.on('settings:changed', fn)
    return () => ipcRenderer.removeListener('settings:changed', fn)
  }
})
