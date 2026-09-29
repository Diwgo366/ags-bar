import GLib from "gi://GLib"
import Gio from "gi://Gio"
import GioUnix from "gi://GioUnix"
import { Gdk, Gtk } from "ags/gtk4"

const DESKTOP_DIRS = [
  "/usr/share/applications",
  "/usr/local/share/applications",
  `${GLib.get_home_dir()}/.local/share/applications`,
]

const wmClassToIcon = new Map()
let initialized = false

function scanDesktopFiles() {
  if (initialized) return
  initialized = true

  for (const dir of DESKTOP_DIRS) {
    const file = Gio.File.new_for_path(dir)
    if (!file.query_exists(null)) continue

    try {
      const enumerator = file.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null)
      let info
      while ((info = enumerator.next_file(null))) {
        const name = info.get_name()
        if (!name.endsWith(".desktop")) continue

        const desktopPath = `${dir}/${name}`
        try {
          const app = GioUnix.DesktopAppInfo.new_from_filename(desktopPath)
          if (!app) continue

          const wmClass = app.get_startup_wm_class()
          const icon = app.get_icon()?.to_string()
          const desktopId = name.slice(0, -8)

          if (wmClass && icon) {
            wmClassToIcon.set(wmClass, icon)
            const lower = wmClass.toLowerCase()
            if (lower !== wmClass) wmClassToIcon.set(lower, icon)
          }
          if (icon) {
            wmClassToIcon.set(desktopId, icon)
            const lower = desktopId.toLowerCase()
            if (lower !== desktopId) wmClassToIcon.set(lower, icon)
          }
        } catch {
        }
      }
    } catch {
    }
  }
}

export function getIconForWMClass(wmClass) {
  if (!wmClass) return null
  scanDesktopFiles()

  return wmClassToIcon.get(wmClass) ?? wmClassToIcon.get(wmClass.toLowerCase()) ?? null
}

export function tryIcon(iconTheme, name) {
  if (iconTheme.has_icon(name)) return name
  return null
}

export function getIconName(clientClass) {
  if (!clientClass) return null

  const display = Gdk.Display.get_default()
  if (!display) {
    return "application-x-executable"
  }
  const iconTheme = Gtk.IconTheme.get_for_display(display)

  const mappedIcon = getIconForWMClass(clientClass)
  if (mappedIcon) {
    const direct = tryIcon(iconTheme, mappedIcon)
    if (direct) return direct
  }

  const parts = clientClass.split(".")
  if (parts.length >= 2 && parts[0].length <= 3) {
    const extracted = parts[parts.length - 1]
    const direct = tryIcon(iconTheme, extracted)
    if (direct) return direct
  }

  const lower = clientClass.toLowerCase()
  const dashed = lower.replace(/\s+/g, "-")

  return (
    tryIcon(iconTheme, lower) ??
    tryIcon(iconTheme, dashed) ??
    tryIcon(iconTheme, `application-${lower}`) ??
    tryIcon(iconTheme, `application-${dashed}`) ??
    "application-x-executable"
  )
}