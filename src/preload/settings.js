// Preload for the settings window only. The main process accepts these channels only from that
// window's webContents.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  setCalendar: (url) => ipcRenderer.invoke('settings:calendar-set', url),
  removeCalendar: () => ipcRenderer.invoke('settings:calendar-remove'),
  googleSignIn: (creds) => ipcRenderer.invoke('settings:google-sign-in', creds),
  googleSignOut: () => ipcRenderer.invoke('settings:google-sign-out'),
  openGoogleConsole: () => ipcRenderer.send('settings:open-google-console'),
  onChange: (cb) => {
    const fn = (_e, data) => cb(data)
    ipcRenderer.on('settings:changed', fn)
    return () => ipcRenderer.removeListener('settings:changed', fn)
  }
})
