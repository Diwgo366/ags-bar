import { createPoll } from "ags/time"
import { LOCALE, TIME_FORMAT, DATE_FORMAT, INTERVAL } from "../config.js"

export default () => {
  const time = createPoll("", INTERVAL.CLOCK, () =>
    new Date().toLocaleTimeString(LOCALE, TIME_FORMAT),
  )

  const date = createPoll("", INTERVAL.DATE, () =>
    new Date().toLocaleDateString(LOCALE, DATE_FORMAT),
  )

  return (
    <box class="clock-container">
      <label class="clock-time" label={time} />
      <box class="separator" />
      <label class="clock-date" label={date} />
    </box>
  )
}
