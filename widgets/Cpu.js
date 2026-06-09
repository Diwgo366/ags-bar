import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { INTERVAL } from "../config.js"

let prevIdle = 0
let prevTotal = 0
let first = true

export default () => {
  const cpu = createPoll("0%", INTERVAL.CPU, () => {
    try {
      const [ok, out] = GLib.file_get_contents("/proc/stat")
      if (!ok) return "N/A"
      const parts = new TextDecoder().decode(out).split("\n")[0].split(/\s+/).slice(1)

      const idle = parseInt(parts[3]) + parseInt(parts[4])
      const total = parts.reduce((a, b) => a + parseInt(b), 0)

      if (first) {
        first = false
        prevIdle = idle
        prevTotal = total
        return "0%"
      }

      const diffIdle = idle - prevIdle
      const diffTotal = total - prevTotal
      const usage = ((1 - diffIdle / diffTotal) * 100)

      prevIdle = idle
      prevTotal = total

      return `${Math.round(usage)}%`
    } catch {
      return "N/A"
    }
  })

  return (
    <centerbox class="right-item">
      <box $type="start" />
      <box $type="center">
        <image
          icon_name="cpu-symbolic"
          css="-gtk-icon-style: symbolic;"
        />
        <label label={cpu} />
      </box>
      <box $type="end" />
    </centerbox>
  )
}
