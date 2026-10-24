import { contextBridge, ipcRenderer } from 'electron'

const on = (channel) => (cb) => {
  const fn = (_e, data) => cb(data)
  ipcRenderer.on(channel, fn)
  return () => ipcRenderer.removeListener(channel, fn)
}

contextBridge.exposeInMainWorld('island', {
  getState: () => ipcRenderer.invoke('island:state'),
  calendarWeek: (start) => ipcRenderer.invoke('island:calendar-week', start),
  onClaude: on('island:claude'),
  onMedia: on('island:media'),
  onCalendar: on('island:calendar'),
  onSettings: on('island:settings'),
  onAttention: on('island:attention'),
  onFullscreen: on('island:fullscreen'),
  onSystem: on('island:system'),
  onPointer: on('island:pointer'),
  decide: (id, decision, answers) => ipcRenderer.send('island:decide', id, decision, answers),
  media: (cmd) => ipcRenderer.send('island:media', cmd),
  system: (cmd, value) => ipcRenderer.send('island:system', String(cmd), value),
  setSystemWatch: (on) => ipcRenderer.send('island:system-watch', !!on),
  setInteractive: (on) => ipcRenderer.send('island:interactive', !!on),
  openSettings: () => ipcRenderer.send('island:open-settings')
})
