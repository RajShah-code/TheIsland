// Shared motion language (same as the Archway site). Strong ease-outs for entrances, critically
// damped springs for UI. The island itself gets a little bounce, like the real one.
export const easeOut = [0.23, 1, 0.32, 1]
export const easeReveal = [0.16, 1, 0.3, 1]
export const easeDraw = [0.65, 0, 0.35, 1]

export const springUI = { type: 'spring', bounce: 0, duration: 0.45 }
export const springIsland = { type: 'spring', bounce: 0.22, duration: 0.6 }
