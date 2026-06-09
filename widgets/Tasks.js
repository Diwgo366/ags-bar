import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { INTERVAL } from "../config.js"

const TASKS_FILE = "/tmp/brave-tasks.json"

export default () => {
  const display = createPoll("...", INTERVAL.TASKS, () => {
    try {
      const [ok, out] = GLib.file_get_contents(TASKS_FILE)
      if (!ok) return ""

      const data = JSON.parse(new TextDecoder().decode(out))
      const pending = data.pending ?? 0
      if (pending === 0) return ""

      return `${pending}`
    } catch {
      return "?"
    }
  })

  return (
    <centerbox class="right-item">
      <box $type="start" />
      <box $type="center">
        <image
          icon_name="checkbox-symbolic"
          css="-gtk-icon-style: symbolic;"
        />
        <label label={display} />
      </box>
      <box $type="end" />
    </centerbox>
  )
}
