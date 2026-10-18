import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { INTERVAL } from "../config/appConfig.js"

type NetworkState = "wifi" | "wired" | "disconnected" | "disabled" | "offline"
type NetworkInfo = {
  state: NetworkState
  name: string
  signal: number | null
}

const DEBUG_LOG = "/tmp/ags-network-debug.log"
const OFFLINE: NetworkInfo = { state: "offline", name: "", signal: null }

function debugNetwork(event: string, details: Record<string, unknown>) {
  try {
    const timestamp = new Date().toISOString()
    const line = `${JSON.stringify({ timestamp, event, ...details })}\n`
    const [ok, previous] = GLib.file_get_contents(DEBUG_LOG)
    const existing = ok ? new TextDecoder().decode(previous) : ""
    GLib.file_set_contents(DEBUG_LOG, existing + line)
  } catch (error) {
    console.warn("No se pudo escribir el log de diagnóstico de red:", error)
  }
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
}

function parseTerseLine(line: string) {
  const fields: string[] = []
  let field = ""
  let escaped = false
  for (const char of line) {
    if (escaped) {
      field += char
      escaped = false
    } else if (char === "\\") {
      escaped = true
    } else if (char === ":") {
      fields.push(field)
      field = ""
    } else {
      field += char
    }
  }
  fields.push(field)
  return fields
}

async function runNmcli(args: string[]) {
  return execAsync(["nmcli", "--colors", "no", ...args])
}

async function getNetworkState(): Promise<NetworkInfo> {
  try {
    const out = await runNmcli([
      "-t",
      "-f",
      "TYPE,STATE,CONNECTION",
      "device",
      "status",
    ])
    const cleanOutput = stripAnsi(out).trim()
    debugNetwork("nmcli-device-status", { output: cleanOutput })

    let wifiAvailable = false
    for (const line of cleanOutput.split("\n")) {
      const [type, state, connection] = parseTerseLine(line)
      if (state === "connected" && type === "wifi") {
        let active: string[] | undefined
        try {
          const wifiInfo = await runNmcli([
            "-t",
            "-f",
            "IN-USE,SSID,SIGNAL",
            "device",
            "wifi",
            "list",
          ])
          active = wifiInfo
            .split("\n")
            .map((wifiLine) => parseTerseLine(stripAnsi(wifiLine)))
            .find(([inUse]) => inUse === "*")
        } catch (error) {
          debugNetwork("wifi-details-error", { error: String(error) })
        }
        const result: NetworkInfo = {
          state: "wifi",
          name: active?.[1] || connection || "Wi-Fi",
          signal: active?.[2] ? Number(active[2]) : null,
        }
        debugNetwork("detected-state", { type, state, ...result })
        return result
      }
      if (state === "connected" && type === "ethernet") {
        const result: NetworkInfo = {
          state: "wired",
          name: connection || "Ethernet",
          signal: null,
        }
        debugNetwork("detected-state", { type, state, ...result })
        return result
      }
      if (type === "wifi" && state !== "unavailable") wifiAvailable = true
    }

    const wifiRadio = stripAnsi(await runNmcli(["radio", "wifi"]))
    const state: NetworkState =
      wifiRadio.trim() === "disabled"
        ? "disabled"
        : wifiAvailable
          ? "disconnected"
          : "offline"
    debugNetwork("detected-state", {
      wifiAvailable,
      wifiRadio: wifiRadio.trim(),
      state,
    })
    return { state, name: "", signal: null }
  } catch (error) {
    debugNetwork("query-error", { error: String(error) })
    console.warn("No se pudo consultar el estado de red con nmcli:", error)
    return OFFLINE
  }
}

export default () => {
  const status = createPoll(OFFLINE, INTERVAL.NETWORK, () =>
    getNetworkState().catch((error) => {
      debugNetwork("poll-error", { error: String(error) })
      return OFFLINE
    }),
  )

  const icon = status.as((info) => {
    switch (info.state) {
      case "wifi": {
        if (info.signal === null) return "network-wireless-connected"
        if (info.signal >= 80) return "network-wireless-signal-excellent"
        if (info.signal >= 60) return "network-wireless-signal-good"
        if (info.signal >= 40) return "network-wireless-signal-ok"
        if (info.signal >= 20) return "network-wireless-signal-low"
        return "network-wireless-signal-none"
      }
      case "wired":
        return "network-wired"
      case "disconnected":
        return "network-wireless-offline"
      default:
        return "network-offline"
    }
  })

  const label = status.as((info) => {
    if (info.state === "wifi") return info.name
    return info.state === "wired" ? info.name : ""
  })

  return (
    <centerbox
      class="bar-item right-item bar-button"
      tooltip_text={status.as((info) => {
        switch (info.state) {
          case "wifi":
            return info.signal === null
              ? `Conectado por Wi-Fi: ${info.name}`
              : `Conectado por Wi-Fi: ${info.name} (${info.signal}% de señal)`
          case "wired":
            return `Conectado por Ethernet: ${info.name}`
          case "disconnected":
            return "Wi-Fi desconectado"
          case "disabled":
            return "Wi-Fi desactivado"
          default:
            return "Sin conexión de red o NetworkManager no disponible"
        }
      })}
    >
      <box $type="start" />
      <box $type="center">
        <image icon_name={icon} css="-gtk-icon-style: symbolic;" />
        <label label={label} />
      </box>
      <box $type="end" />
    </centerbox>
  )
}
