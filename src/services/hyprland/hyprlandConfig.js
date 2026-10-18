import GLib from "gi://GLib"
import { execAsync } from "ags/process"

const OPTION_KEYS = [
  "decoration:active_opacity",
  "decoration:inactive_opacity",
  "decoration:rounding",
  "general:gaps_out",
  "general:col.active_border",
  "general:col.inactive_border",
]

async function getOption(option) {
  try {
    const proc = execAsync(`hyprctl getoption ${option} -j`)
    const out = await Promise.race([
      proc,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 500),
      ),
    ])
    return JSON.parse(out)
  } catch {
    return null
  }
}

export async function getHyprOptions() {
  const entries = await Promise.all(
    OPTION_KEYS.map(async (key) => [key, await getOption(key)]),
  )
  return Object.fromEntries(entries)
}

export function watchConfig(callback) {
  const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
    callback()
    return GLib.SOURCE_CONTINUE
  })

  return () => GLib.source_remove(timer)
}
