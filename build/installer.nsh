; Extra uninstall step for electron-builder's NSIS installer.
; "Start with Windows" is a shortcut in the user's Startup folder (see index.js), so remove it with the app.
; Claude Code hooks and %USERPROFILE%\.theisland are left alone: the hooks exit silently when the app
; is gone, and the README says to remove them from the tray first.
!macro customUnInstall
  Delete "$SMSTARTUP\TheIsland.lnk"
!macroend
