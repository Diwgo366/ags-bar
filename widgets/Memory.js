import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { INTERVAL } from "../config.js"

export default () => {
  const mem = createPoll("", INTERVAL.MEMORY, () => {
    try {
      const [ok, out] = GLib.file_get_contents("/proc/meminfo")
      if (!ok) return "N/A"
      const lines = new TextDecoder().decode(out).split("\n")
      const total = parseInt(lines[0].split(/\s+/)[1])
      const avail = parseInt(lines[2].split(/\s+/)[1])
      if (!total || !avail) return "N/A"
      const used = ((total - avail) / total) * 100
      return `${Math.round(used)}%`
    } catch {
      return "N/A"
    }
  })

  return (
    <centerbox class="right-item">
      <box $type="start" />
      <box $type="center">
        <image
          icon_name="memory-symbolic"
          css="-gtk-icon-style: symbolic;"
        />
        <label label={mem} />
      </box>
      <box $type="end" />
    </centerbox>
  )
}
