import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { Gdk, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { AGS_DIR } from "../config/appConfig.js"

const THEME_PATH = `${AGS_DIR}/src/themes/theme.json`

function loadTheme() {
  const [ok, content] = GLib.file_get_contents(THEME_PATH)
  if (!ok) throw new Error(`No se pudo leer ${THEME_PATH}`)
  return JSON.parse(new TextDecoder().decode(content))
}

export function getThemeColors() {
  return loadTheme().colors
}

export function getThemeIconTheme() {
  return loadTheme().icons
}

function generateCSS() {
  const t = loadTheme()
  const c = t.colors

  const [, roundingOutput] = GLib.spawn_command_line_sync(
    "hyprctl -j getoption decoration:rounding",
  )
  const rounding = JSON.parse(new TextDecoder().decode(roundingOutput)).int

  const [, gapsOutput] = GLib.spawn_command_line_sync(
    "hyprctl -j getoption general:gaps_out",
  )
  const gaps = Number.parseFloat(
    JSON.parse(new TextDecoder().decode(gapsOutput)).css,
  )

  const [, borderWidthOutput] = GLib.spawn_command_line_sync(
    "hyprctl -j getoption general:border_size",
  )
  const border_wd = JSON.parse(new TextDecoder().decode(borderWidthOutput)).int
  const innerRounding = Math.max(rounding - border_wd, 0)

  const [, acOpacity] = GLib.spawn_command_line_sync(
    "hyprctl -j getoption decoration:active_opacity",
  )
  const ac_op = JSON.parse(new TextDecoder().decode(acOpacity)).float

  const [, icOpacity] = GLib.spawn_command_line_sync(
    "hyprctl -j getoption decoration:inactive_opacity",
  )
  const ic_op = JSON.parse(new TextDecoder().decode(icOpacity)).float

  return `
/* === TEMA: ${t.name} === */

@define-color bg alpha(${c.bg}, ${ac_op});
@define-color bg-alt alpha(${c.bgAlt}, ${ac_op});
@define-color fg ${c.fg};
@define-color fg-alt ${c.fgAlt};
@define-color bd alpha(${c.bd}, ${ic_op});
@define-color bd-alt alpha(${c.bdAlt}, ${ac_op});

@define-color accent ${c.accent};
@define-color red ${c.red};
@define-color green ${c.green};
@define-color yellow ${c.yellow};
@define-color blue ${c.blue};
@define-color magenta ${c.magenta};
@define-color cyan ${c.cyan};

window, label, box {
  font-family: "${t.font.family ?? "Arial"}";
  font-size: ${t.font.size ?? 13}px;
  background-color: transparent;
  border: 0;
  border-color: transparent;
  background-clip: padding-box;
  margin: 0;
  padding: 0;
}

window {
  margin: ${gaps}px;
  margin-bottom: 0;
}

label {
  font-weight: normal;
  color: @fg;
}

.large-label {
  padding: 0 10px;
}

.short-label {
  padding: 0 5px;
}

.bar-section {
  border-radius: ${rounding}px;
  border: ${border_wd}px solid @bd;
  background-color: @bg;
}

.bar-section:hover {
  border-color: @bd-alt;
}

.separator {
  margin: 5px 0;
  min-width: ${border_wd}px;
  background-color: @bd;
}

.bar-section:hover .separator {
  background-color: @bd-alt;
}

.workspace {
  min-width: 40px;
  min-height: 40px;
}

.bar-button {
  border: 0;
  border-radius: ${innerRounding}px;
  transition: background-color 0.2s ease;
}

.bar-button:hover, .bar-button.focused {
  background-color: @bg-alt;
}

.bar-section:hover .bar-button.focused:not(:hover) {
  background-color: transparent;
}

.bar-item {
  min-width: 65px;
}

popover > arrow { border: 2px solid @bd-alt; background-color: @bg; }
popover > contents { border: 2px solid @bd-alt; background-color: @bg; padding: 10px; }
popover button { border: 2px solid @bd; padding: 5px 15px; margin: 5px; border-radius: ${rounding}px; }
popover button:hover, popover button:checked { border-color: @accent; background-color: @accent; color: @bg; }

.overlay-content {
  background-color: @bg;
  border-radius: ${rounding}px;
  border: ${border_wd}px solid @bd-alt;
  margin-bottom: ${2 * gaps}px;
  padding: 10px 10px;
  min-width: 150px;
  min-height: 50px;
}

.overlay-icon {
  color: @fg;
}

.overlay-on .overlay-icon, .overlay-on .overlay-label {
  color: @fg;
}

.overlay-off .overlay-icon, .overlay-off .overlay-label {
  color: @fg-alt;
}

.cal-popup { background-color: @bg; border-radius: 12px; border: 2px solid @bd; padding: 12px; }
.cal-header { color: @fg; font-weight: bold; font-size: 15px; }
.cal-day-header { color: @fg-alt; font-size: 11px; font-weight: bold; }
.cal-day-header.today { color: @green; }
.cal-hour-label { color: @fg-alt; font-size: 10px; }
.cal-cell { background-color: alpha(${c.bd}, 0.1); border-bottom: 1px solid alpha(${c.bd}, 0.2); border-right: 1px solid alpha(${c.bd}, 0.2); padding: 2px; }
.cal-event { border-radius: 4px; border-left: 3px solid; padding: 3px 5px; }
.cal-event-time, .cal-event-title, .cal-event-salon { color: @fg; }
.cal-close { background: transparent; border: none; color: @fg-alt; font-size: 18px; min-width: 24px; min-height: 24px; }
.cal-close:hover { color: @red; }

/* Theme Selector Styles */
.theme-selector-window {
  background-color: transparent;
}

.preview-container {
  background-color: transparent;
  padding: 20px;
}

.theme-nav-box {
  min-width: 42px;
  min-height: 260px;
  border-radius: 8px;
  background-color: alpha(${c.bgAlt}, 0.9);
  color: @fg;
  transition: background-color 0.2s, color 0.2s;
}

.theme-nav-box:hover {
  background-color: alpha(${c.accent}, 0.2);
  color: @accent;
}

.theme-nav-arrow {
  min-width: 42px;
  min-height: 260px;
  color: @fg;
  font-size: 40px;
}

.theme-card {
  min-width: 320px;
  min-height: 260px;
  padding: 8px;
  border-radius: 8px;
  background-color: alpha(${c.bgAlt}, 0.96);
}

.wallpaper-preview {
  min-width: 320px;
  min-height: 180px;
  border-radius: 4px;
  background-color: @bg;
}

.preview-name-box {
  min-height: 50px;
  margin-top: 8px;
  border-top: 1px solid alpha(${c.fgAlt}, 0.35);
}

.preview-name {
  color: @fg;
  font-size: 15px;
  font-weight: bold;
}
`
}

let cssProvider = null
let calendarStyleProvider = null
let calendarStyles = ""
let themeMonitor = null

function watchThemeFile() {
  if (themeMonitor) return

  const file = Gio.File.new_for_path(THEME_PATH)
  themeMonitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null)
  themeMonitor.connect("changed", (_monitor, _file, _otherFile, event) => {
    if (event === Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
      applyTheme()
    }
  })
}

export function registerCalendarStyle(cssClass, background, border) {
  calendarStyles += `.${cssClass} { background-color: alpha(${background}, 0.85); border-left-color: ${border}; }\n`

  if (!calendarStyleProvider) {
    calendarStyleProvider = new Gtk.CssProvider()
    const display = Gdk.Display.get_default()
    if (display) {
      Gtk.StyleContext.add_provider_for_display(
        display,
        calendarStyleProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_USER,
      )
    }
  }
  calendarStyleProvider.load_from_string(calendarStyles)
}

export function applyTheme() {
  watchThemeFile()

  const display = Gdk.Display.get_default()
  const iconThemeName = getThemeIconTheme()
  const settings = Gtk.Settings.get_default()
  if (
    settings &&
    iconThemeName &&
    settings.gtk_icon_theme_name !== iconThemeName
  ) {
    settings.gtk_icon_theme_name = iconThemeName
  }

  const css = generateCSS()

  if (cssProvider) {
    Gtk.StyleContext.remove_provider_for_display(display, cssProvider)
  }
  cssProvider = new Gtk.CssProvider()
  cssProvider.load_from_string(css)
  Gtk.StyleContext.add_provider_for_display(
    display,
    cssProvider,
    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
  )
}

export function reloadTheme() {
  applyTheme()
}
