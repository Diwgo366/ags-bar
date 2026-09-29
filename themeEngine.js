import { AGS_THEME, alpha, rgba } from "./themes/base.js"
import { getHyprOptions } from "./hyprconfig.js"
import { Gdk, Gtk } from "ags/gtk4"

let cssProvider = null
let currentTheme = AGS_THEME

export function setTheme(theme) {
    currentTheme = { ...AGS_THEME, ...theme }
}

export function getTheme() {
    return currentTheme
}

function hyprColorToCSS(color) {
    if (!color?.gradient) return null
    const hex = color.gradient.split(" ")[0]
    return `#${hex.slice(2)}`
}

function parseGaps(val) {
    if (val?.int) return val.int
    if (val?.css) return parseInt(val.css.split(" ")[0]) || 0
    return 10
}

export async function generateThemeCSS() {
    const hyprOpts = await getHyprOptions()
    const t = currentTheme
    const hypr = t.hyprland
    
    // Merge runtime Hyprland values
    const ao = hyprOpts["decoration:active_opacity"]?.float ?? hypr.activeOpacity
    const io = hyprOpts["decoration:inactive_opacity"]?.float ?? hypr.inactiveOpacity
    const rounding = hyprOpts["decoration:rounding"]?.int ?? hypr.rounding
    const gaps = parseGaps(hyprOpts["general:gaps_out"])
    const activeBorder = hyprColorToCSS(hyprOpts["general:col.active_border"]) ?? hypr.activeBorder.replace("0x", "#")
    const inactiveBorder = hyprColorToCSS(hyprOpts["general:col.inactive_border"]) ?? hypr.inactiveBorder.replace("0x", "#")
    
    // Generate @define-color variables
    const vars = [
        `bg ${alpha(t.bg, ao)}`,
        `ac-txt ${activeBorder}`,
        `ic-txt ${inactiveBorder}`,
        `ac-bd ${alpha(activeBorder, ao)}`,
        `ic-bd ${alpha(inactiveBorder, io)}`,
        `accent ${t.semantic.accent.main}`,
        `red ${t.semantic.error.main}`,
        `green ${t.semantic.success.main}`,
        `yellow ${t.semantic.warning.main}`,
        `orange ${t.semantic.accent.main}`,
        `cyan ${t.semantic.info.main}`,
        `magenta ${t.semantic.secondary.main}`,
        `blue ${t.semantic.primary.main}`,
        `fg ${t.fg}`,
        `fg-muted ${t.fgMuted}`,
        `fg-subtle ${t.fgSubtle}`,
        `bg-alt ${alpha(t.bgAlt, t.alpha.surface)}`,
        `bg-elevated ${alpha(t.bgElevated, t.alpha.surface)}`,
        `border ${t.border}`,
        `border-focus ${t.borderFocus}`,
        `border-subtle ${t.borderSubtle}`,
    ].map(([name, value]) => `@define-color ${name} ${value};`).join("\n")
    
    const css = `
${vars}

window, button, label, button, menubutton, image, popover > * {
  background-color: transparent;
  border: 0;
  padding: 0;
  margin: 0;
}

button, menubutton {
  background-color: transparent;
  transition: all 200ms ease;
  background-image: none;
  border-radius: ${rounding}px;
}

button {
  background-color: alpha(@accent, 0.5);
}

button:hover, menubutton:hover, button:checked, menubutton:checked {
  background-color: @accent;
}

window {
  margin: ${gaps}px;
  margin-bottom: 0;
}

label {
  font-family: "${t.typography.font_family}", monospace;
  color: @ac-txt;
  font-size: ${t.typography.font_size + 5}px;
  font-weight: bold;
}

.center, .right, .left {
  border-radius: ${rounding}px;
  border: 2px solid @ic-bd;
  background-color: @bg;
}

.clock-time, .clock-date {
  padding: 0px 10px;
}

.center:hover, .right:hover, .left:hover {
  border-color: @ac-bd;
}

.separator {
  margin: 5px 0px;
  min-width: 2px;
  background-color: @ic-txt;
}

.center:hover .separator, .right:hover .separator, .left:hover .separator {
  background-color: @ac-txt;
}

.workspace {
  min-width: 40px;
  min-height: 40px;
  -gtk-icon-size: 24px;
}

.workspace label {
  color: @ic-txt;
}

.workspace:hover label, .workspace.focused label {
  color: @ac-txt;
}

.right-item {
  min-width: 65px;
  -gtk-icon-size: 24px;
}

.bar-button {
  border-radius: ${rounding}px;
  transition: all 200ms ease;
}

.left:hover .bar-button.focused {
  background-color: transparent;
}

.left:hover .bar-button.focused:hover {
  background-color: @accent;
}

.bar-button:hover, .bar-button.focused {
  background-color: @accent;
}

popover > arrow {
  border: 2px solid @ac-bd;
  background-color: @bg;
}

popover > contents {
  border: 2px solid @ac-bd;
  background-color: @bg;
  padding: 10px;
}

menubutton {
  border-radius: ${rounding}px;
}

popover button {
  border: 2px solid @ic-bd;
  padding: 5px 15px;
  margin: 5px;
}

popover button:hover,
popover button:checked {
  border-color: @ac-bd;
  background-color: @accent;
}

.overlay-outer {
  margin-bottom: 80px;
}

.overlay-content {
  min-width: 200px;
  padding: 8px 10px;
  background-color: ${alpha(t.bg, 0.95)};
  border-radius: 12px;
}

.overlay-icon {
  -gtk-icon-style: regular;
  color: @ac-txt;
}

.overlay-label {
  font-family: "${t.typography.font_family}", monospace;
  font-size: 18px;
  font-weight: bold;
  color: @ac-txt;
}

.cal-popup {
  background-color: @bg;
  border-radius: 12px;
  border: 2px solid @ic-bd;
  padding: 12px;
}
.cal-header {
  color: @ac-txt;
  font-size: 15px;
  font-weight: bold;
}
.cal-day-header {
  color: @ac-txt;
  font-size: 11px;
  font-weight: bold;
}
.cal-day-header.today {
  color: @green;
}
.cal-hour-label {
  color: @ic-txt;
  font-size: 10px;
}
.cal-cell {
  background-color: ${alpha(t.border, 0.1)};
  border-bottom: 1px solid ${alpha(t.border, 0.2)};
  border-right: 1px solid ${alpha(t.border, 0.2)};
  padding: 2px;
}
.cal-event {
  border-radius: 4px;
  border-left: 3px solid;
  padding: 3px 5px;
}
.cal-event-time {
  color: @ac-txt;
  font-size: 9px;
  font-weight: bold;
}
.cal-event-title {
  color: @ac-txt;
  font-size: 9px;
}
.cal-event-salon {
  color: @ac-txt;
  font-size: 8px;
  opacity: 0.9;
}
.cal-close {
  background: transparent;
  border: none;
  color: @ic-txt;
  font-size: 18px;
  min-width: 24px;
  min-height: 24px;
}
.cal-close:hover {
  color: @red;
}
`
    return css
}

export async function applyTheme() {
    const display = Gdk.Display.get_default()
    const css = await generateThemeCSS()
    
    if (cssProvider) {
        Gtk.StyleContext.remove_provider_for_display(display, cssProvider)
    }
    
    cssProvider = new Gtk.CssProvider()
    cssProvider.load_from_string(css)
    Gtk.StyleContext.add_provider_for_display(
        display, cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    )
}

export function watchTheme(callback) {
    // Watch Hyprland config changes
    return watchConfig(async () => {
        await applyTheme()
        if (callback) callback()
    })
}

// Re-export watchConfig from hyprconfig
export { watchConfig } from "./hyprconfig.js"