// The one place widgets are registered. A widget is
//   { id, name, width, options, Panel, Compact?, visible?(state) }
// Panel is one column of the open island (width px, columns are separated by a divider).
// Compact renders in the closed notch (return null to hide). visible() hides the column entirely.
// Order here is display order. The future settings UI will choose and reorder these.
import calendar from './calendar'
import clock from './clock'
import music from './music'

export const widgets = [music, clock, calendar]
