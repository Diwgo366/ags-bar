import { createPoll } from "ags/time"
import { Gtk } from "ags/gtk4"
import {
  LOCALE,
  TIME_FORMAT,
  DATE_FORMAT,
  INTERVAL,
} from "../config/appConfig.js"
import { getCalendarPopup } from "./CalendarPopup.tsx"

export default () => {
  const time = createPoll("", INTERVAL.CLOCK, () =>
    new Date().toLocaleTimeString(LOCALE, TIME_FORMAT),
  )

  const date = createPoll("", INTERVAL.DATE, () =>
    new Date().toLocaleDateString(LOCALE, DATE_FORMAT),
  )

  const calendar = getCalendarPopup()

  return (
    <box
      class="bar-button"
      $={(self) => {
        const click = Gtk.GestureClick.new()
        click.connect("pressed", () => calendar.toggle())
        self.add_controller(click)
      }}
    >
      <box>
        <label class="large-label" label={time} />
        <box class="separator" />
        <label class="large-label" label={date} />
      </box>
    </box>
  )
}
