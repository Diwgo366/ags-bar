import { Astal, Gtk, Gdk } from "ags/gtk4"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import app from "ags/gtk4/app"

// ── Constants ──────────────────────────────────────────────
const FADE_DURATION = 150
const HIDE_DELAY = 2000
const LED_POLL_INTERVAL = 200

// ── Display config per type (icon, label, optional cssClass) ─
const DISPLAY = {
  volume: {
    icon: (v) => v <= 0 ? "audio-volume-muted-symbolic" :
            v < 33 ? "audio-volume-low-symbolic" :
            v < 66 ? "audio-volume-medium-symbolic" :
            "audio-volume-high-symbolic",
    label: (v) => `${v}%`,
  },
  brightness: {
    icon: (v) => v < 33 ? "display-brightness-low-symbolic" :
            v < 66 ? "display-brightness-medium-symbolic" :
            "display-brightness-high-symbolic",
    label: (v) => `${v}%`,
  },
  capslock: {
    icon: (v) => v === "true" ? "capslock-on" : "capslock-off",
    label: (v) => v === "true" ? "Bloq Mayús: ON" : "Bloq Mayús: OFF",
    cssClass: (v) => v === "true" ? "overlay-on" : "overlay-off",
  },
  numlock: {
    icon: (v) => v === "true" ? "numlock-on" : "numlock-off",
    label: (v) => v === "true" ? "Bloq Num: ON" : "Bloq Num: OFF",
    cssClass: (v) => v === "true" ? "overlay-on" : "overlay-off",
  },
  mute: {
    icon: (v) => v === "true" ? "audio-volume-muted-symbolic" : "audio-volume-high-symbolic",
    label: (v) => v === "true" ? "Muteado" : "Activado",
    cssClass: (v) => v === "true" ? "overlay-off" : "overlay-on",
  },
}

// ── LED helpers ────────────────────────────────────────────
function findLEDPath(type) {
  try {
    const dir = Gio.File.new_for_path("/sys/class/leds")
    const enumerator = dir.enumerate_children(
      "standard::name", Gio.FileQueryInfoFlags.NONE, null,
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

function readLED(path) {
  const [ok, buf] = GLib.file_get_contents(path)
  if (!ok) return null
  return new TextDecoder().decode(buf).trim()
}

// ─── CSS provider (once) ──────────────────────────────────
let _cssReady = false
function ensureOverlayCSS() {
  if (_cssReady) return
  _cssReady = true
  const p = new Gtk.CssProvider()
  p.load_from_string(`
    .overlay-icon.overlay-on, .overlay-label.overlay-on { color: #50fa7b; }
    .overlay-icon.overlay-off, .overlay-label.overlay-off { color: #7a7a7a; }
  `)
  Gtk.StyleContext.add_provider_for_display(
    Gdk.Display.get_default(), p,
    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
  )
}

// ─── Overlay window creation ──────────────────────────────
function createOverlayWindow() {
  ensureOverlayCSS()

  let hideTimeout = null
  let animSource = null

  // ── Animation ──
  function animateOpacity(widget, target, duration, cb) {
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
    icon_name: "", pixel_size: 32, icon_size: Gtk.IconSize.LARGE,
  })
  iconImage.add_css_class("overlay-icon")

  const label = new Gtk.Label({ label: "" })
  label.add_css_class("overlay-label")

  const centerBox = new Gtk.CenterBox()
  centerBox.set_start_widget(new Gtk.Box())
  centerBox.set_center_widget(iconImage)
  centerBox.set_end_widget(new Gtk.Box())

  const contentBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL, spacing: 8,
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

  // ── Show / update ──
  function show(type, value) {
    const cfg = DISPLAY[type]
    if (!cfg) return

    iconImage.set_from_icon_name(cfg.icon(value))
    label.set_label(cfg.label(value))

    iconImage.remove_css_class("overlay-on")
    iconImage.remove_css_class("overlay-off")
    label.remove_css_class("overlay-on")
    label.remove_css_class("overlay-off")

    if (cfg.cssClass) {
      const klass = cfg.cssClass(value)
      iconImage.add_css_class(klass)
      label.add_css_class(klass)
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
    null, "com.ags.Overlay", "Show", "/com/ags/Overlay",
    null, Gio.DBusSignalFlags.NONE,
    (_conn, _sender, _path, _iface, _signal, params) => {
      const [type, value] = params.deep_unpack()
      show(type, value)
    },
  )

  // ── LED polling ──
  const leds = [
    { type: "capslock", path: findLEDPath("capslock"), prev: null },
    { type: "numlock", path: findLEDPath("numlock"), prev: null },
  ]

  if (leds.some(l => l.path)) {
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
let overlayInstance = null

export function getOverlay() {
  if (!overlayInstance)
    overlayInstance = createOverlayWindow()
  return overlayInstance
}
