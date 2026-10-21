// The one place widgets are registered. A widget is
//   { id, name, width, options, Panel, Compact?, visible?(state) }
// Panel is one column of the open island (width px, columns are separated by a divider).
// Compact renders in the closed notch (return null to hide). visible() hides the column entirely.
// Order here is the default order; the settings window reorders and hides them (settings.widgets,
// applied with orderedWidgets). Ids must match WIDGET_IDS in src/shared/settings-model.mjs.
import calendar from './calendar'
import clock from './clock'
import music from './music'
import { sortByOrder } from '../../../shared/settings-model.mjs'

export const widgets = [music, clock, calendar]

// Widgets in the user's order, without the hidden ones. Used by the Home tab and the closed pill.
export function orderedWidgets(settings) {
  const hidden = new Set(settings?.widgets?.hidden || [])
  return sortByOrder(widgets, settings?.widgets?.order).filter((w) => !hidden.has(w.id))
}
