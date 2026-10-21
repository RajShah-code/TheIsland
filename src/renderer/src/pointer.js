// One pointer source for the island page. App.jsx feeds it from both places the pointer can come
// from: `island:pointer` polls from main while the window ignores the mouse (see src/main/pointer.js)
// and real mousemove events while the island is interactive. Points are window-relative CSS px.
const subs = new Set()

export function onPointer(fn) {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

export function emitPointer(p) {
  for (const fn of subs) fn(p)
}
