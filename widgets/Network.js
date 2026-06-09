import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { INTERVAL } from "../config.js"

export default () => {
  const status = createPoll("", INTERVAL.NETWORK, async () => {
    try {
      const out = await execAsync("nmcli -t -f TYPE,STATE dev status 2>/dev/null | head -5")
      const lines = out.trim().split("\n")

      for (const line of lines) {
        const [type, state] = line.split(":")
        if (type === "wifi" && state === "connected")
          return "wifi"
        if (type === "ethernet" && state === "connected")
          return "wired"
      }

      const wifiOff = await execAsync("nmcli radio wifi 2>/dev/null")
      return wifiOff.trim() === "enabled" ? "disconnected" : "disabled"
    } catch {
      return "offline"
    }
  })

  const icon = status.as(s => {
    switch (s) {
      case "wifi": return "network-wireless-symbolic"
      case "wired": return "network-wired-symbolic"
      case "disconnected": return "network-wireless-signal-none-symbolic"
      default: return "network-offline-symbolic"
    }
  })

  return (
    <centerbox class="right-item bar-button">
      <box $type="start" />
      <box $type="center">
        <image
          icon_name={icon}
          css="-gtk-icon-style: symbolic;"
        />
      </box>
      <box $type="end" />
    </centerbox>
  )
}
