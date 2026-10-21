// The one place widgets are registered. A widget is { id, name, options, Compact?, Panel? }:
// Compact renders inside the collapsed pill (return null to hide), Panel inside the expanded
// island. Order here is display order. The future settings UI will choose and reorder these.
import calendar from './calendar'
import clock from './clock'
import music from './music'

export const clockWidget = clock
export const widgets = [music, calendar]
