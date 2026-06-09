import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { INTERVAL } from "../config.js"

const THERMAL = "/sys/class/thermal/thermal_zone8/temp"

export default () => {
  const temp = createPoll("0°C", INTERVAL.TEMPERATURE, () => {
    try {
      const [ok, out] = GLib.file_get_contents(THERMAL)
      if (!ok) return "N/A"
      const raw = parseInt(new TextDecoder().decode(out).trim())
      return `${Math.round(raw / 1000)}°C`
    } catch {
      return "N/A"
    }
  })

  return (
    <centerbox class="right-item">
      <box $type="start" />
      <box $type="center">
        <image
          icon_name="psensor_normal"
          css="-gtk-icon-style: symbolic;"
        />
        <label label={temp} />
      </box>
      <box $type="end" />
    </centerbox>
  )
}
