import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { INTERVAL } from "../config/appConfig.js"

export default () => {
  const mem = createPoll("", INTERVAL.MEMORY, () => {
    try {
      const [ok, out] = GLib.file_get_contents("/proc/meminfo")
      if (!ok) return "N/A"
      const content = new TextDecoder().decode(out)
      const totalMatch = content.match(/^MemTotal:\s+(\d+)/m)
      const availableMatch = content.match(/^MemAvailable:\s+(\d+)/m)
      const total = Number(totalMatch?.[1])
      const avail = Number(availableMatch?.[1])
      if (!total || !Number.isFinite(avail)) return "N/A"
      const used = ((total - avail) / total) * 100
      return `${Math.round(used)}%`
    } catch {
      return "N/A"
    }
  })

  return (
    <centerbox class="bar-item right-item">
      <box $type="start" />
      <box $type="center">
        <image icon_name="memory-symbolic" css="-gtk-icon-style: symbolic;" />
        <label label={mem} />
      </box>
      <box $type="end" />
    </centerbox>
  )
}
