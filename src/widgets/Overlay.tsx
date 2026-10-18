import { Astal, Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import app from "ags/gtk4/app"
import Gtk4LayerShell from "gi://Gtk4LayerShell"
import { OVERLAY } from "../config/appConfig.js"

const { FADE_DURATION, HIDE_DELAY, LED_POLL_INTERVAL } = OVERLAY

const DISPLAY: Record<string, {
  icon: (v: number | string) => string
  label: (v: number | string) => string
  state: (v: number | string) => string
}> = {
  volume: {
    icon: (v: number | string) =>
      typeof v === "number"
        ? v <= 0
          ? "audio-volume-muted-symbolic"
          : v < 33
            ? "audio-volume-low-symbolic"
            : v < 66
              ? "audio-volume-medium-symbolic"
              : "audio-volume-high-symbolic"
        : "audio-volume-high-symbolic",
    label: (v: number | string) => `${v}%`,
    state: (v: number | string) =>
      typeof v === "number" ? (v <= 0 ? "overlay-off" : "overlay-on") : "overlay-on",
  },
  brightness: {
    icon: (v: number | string) =>
      typeof v === "number"
        ? v < 33
          ? "display-brightness-low-symbolic"
          : v < 66
            ? "display-brightness-medium-symbolic"
            : "display-brightness-high-symbolic"
        : "display-brightness-high-symbolic",
    label: (v: number | string) => `${v}%`,
    state: (v: number | string) =>
      typeof v === "number" ? (v === 0 ? "overlay-off" : "overlay-on") : "overlay-on",
  },
  capslock: {
    icon: (v: number | string) =>
      v === "true" ? "capslock-on" : "capslock-off",
    label: (v: number | string) =>
      v === "true" ? "Bloq Mayús: ON" : "Bloq Mayús: OFF",
    state: (v: number | string) => (v === "true" ? "overlay-on" : "overlay-off"),
  },
  numlock: {
    icon: (v: number | string) =>
      v === "true" ? "numlock-on" : "numlock-off",
    label: (v: number | string) =>
      v === "true" ? "Bloq Num: ON" : "Bloq Num: OFF",
    state: (v: number | string) => (v === "true" ? "overlay-on" : "overlay-off"),
  },
  mute: {
    icon: (v: number | string) =>
      v === "true"
        ? "audio-volume-muted-symbolic"
        : "audio-volume-high-symbolic",
    label: (v: number | string) => (v === "true" ? "Muteado" : "Activado"),
    state: (v: number | string) => (v === "true" ? "overlay-off" : "overlay-on"),
  },
}

// ── LED helpers ────────────────────────────────────────────
function findLEDPath(type: string) {
  try {
    const dir = Gio.File.new_for_path("/sys/class/leds")
    const enumerator = dir.enumerate_children(
      "standard::name",
      Gio.FileQueryInfoFlags.NONE,
      null,
    )
    let info
    while ((info = enumerator.next_file(null)) !== null) {
      const name = info.get_name()
      if (name.endsWith(`::${type}`))
        return `/sys/class/leds/${name}/brightness`
    }
  } catch (_) {}
  return null
}

function readLED(path: string) {
  const [ok, buf] = GLib.file_get_contents(path)
  if (!ok) return null
  return new TextDecoder().decode(buf).trim()
}

// ─── Overlay window creation ──────────────────────────────
function createOverlayWindow() {
  let hideTimeout: ReturnType<typeof setTimeout> | null = null
  let animSource: number | null = null

  // ── Animation ──
  function animateOpacity(
    widget: Gtk.Widget,
    target: number,
    duration: number,
    cb?: () => void,
  ) {
    if (animSource !== null) {
      GLib.Source.remove(animSource)
      animSource = null
    }
    const start = widget.get_opacity()
    const diff = target - start
    const startTime = GLib.get_monotonic_time()

    animSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      const elapsed = (GLib.get_monotonic_time() - startTime) / 1000
      const progress = Math.min(elapsed / duration, 1)
      widget.set_opacity(start + diff * progress)
      if (progress >= 1) {
        animSource = null
        if (cb) cb()
        return GLib.SOURCE_REMOVE
      }
      return GLib.SOURCE_CONTINUE
    })
  }

  // ── UI ──
  const iconImage = new Gtk.Image({
    icon_name: "",
    pixel_size: 32,
    icon_size: Gtk.IconSize.LARGE,
  })
  iconImage.add_css_class("overlay-icon")

  const label = new Gtk.Label({ label: "" })
  label.add_css_class("overlay-label")

  const centerBox = new Gtk.CenterBox()
  centerBox.set_start_widget(new Gtk.Box())
  centerBox.set_center_widget(iconImage)
  centerBox.set_end_widget(new Gtk.Box())

  const contentBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    halign: Gtk.Align.CENTER,
  })
  contentBox.append(centerBox)
  contentBox.append(label)
  contentBox.add_css_class("overlay-content")

  const outerBox = new Gtk.Box({ halign: Gtk.Align.CENTER })
  outerBox.append(contentBox)
  outerBox.add_css_class("overlay-outer")

  const window = new Astal.Window({
    name: "overlay",
    layer: Astal.Layer.TOP,
    anchor: Astal.WindowAnchor.BOTTOM,
    exclusivity: Astal.Exclusivity.IGNORE,
    visible: false,
    keymode: Astal.Keymode.NONE,
    application: app,
    child: outerBox,
  })

  Gtk4LayerShell.set_namespace(window, "ags-overlay")

  // ── Show / update ──
  function show(type: string, value: string | number) {
    const cfg = DISPLAY[type]
    if (!cfg) return

    iconImage.set_from_icon_name(cfg.icon(value))
    label.set_label(cfg.label(value))

    contentBox.remove_css_class("overlay-on")
    contentBox.remove_css_class("overlay-off")
    if (cfg.state) {
      contentBox.add_css_class(cfg.state(value))
    }

    if (hideTimeout) clearTimeout(hideTimeout)

    window.visible = true
    animateOpacity(window, 1, FADE_DURATION)
    hideTimeout = setTimeout(() => {
      animateOpacity(window, 0, FADE_DURATION, () => {
        window.visible = false
      })
    }, HIDE_DELAY)
  }

  // ── D-Bus subscription ──
  const bus = Gio.bus_get_sync(Gio.BusType.SESSION, null)
  bus.signal_subscribe(
    null,
    "com.ags.Overlay",
    "Show",
    "/com/ags/Overlay",
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn, _sender, _path, _iface, _signal, params) => {
      const unpacked = params.deep_unpack() as [string, string | number]
      const [type, value] = unpacked
      show(type, value)
    },
  )

  // ── LED polling ──
  const leds = [
    {
      type: "capslock",
      path: findLEDPath("capslock"),
      prev: null as string | null,
    },
    {
      type: "numlock",
      path: findLEDPath("numlock"),
      prev: null as string | null,
    },
  ]

  if (leds.some((l) => l.path)) {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, LED_POLL_INTERVAL, () => {
      for (const led of leds) {
        if (!led.path) continue
        const value = readLED(led.path)
        if (value !== null && value !== led.prev) {
          led.prev = value
          show(led.type, value === "1" ? "true" : "false")
        }
      }
      return GLib.SOURCE_CONTINUE
    })
  }

  return { window, show }
}

// ── Singleton ──────────────────────────────────────────────
let overlayInstance: ReturnType<typeof createOverlayWindow> | null = null

export function getOverlay() {
  if (!overlayInstance) overlayInstance = createOverlayWindow()
  return overlayInstance
}

// Export as default for compatibility
export default function Overlay() {
  return getOverlay()
}
