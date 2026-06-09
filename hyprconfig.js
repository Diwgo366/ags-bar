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

function hyprColorToCSS(color) {
  if (!color?.custom) return null
  const hex = color.custom.split(" ")[0]
  return `#${hex.slice(2)}`
}

async function getOption(option) {
  try {
    const out = await execAsync(`hyprctl getoption ${option} -j`)
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

function parseGaps(val) {
  if (val?.int) return val.int
  if (val?.custom) return parseInt(val.custom.split(" ")[0]) || 0
  return 10
}

export function generateCSS(opts) {
  const ao = opts["decoration:active_opacity"]?.float ?? 1
  const io = opts["decoration:inactive_opacity"]?.float ?? 1
  const rounding = opts["decoration:rounding"]?.int ?? 0
  const gaps = parseGaps(opts["general:gaps_out"])
  const activeBorder = hyprColorToCSS(opts["general:col.active_border"]) ?? "#ffffff"
  const inactiveBorder = hyprColorToCSS(opts["general:col.inactive_border"]) ?? "#000000"

  return `
@define-color bg alpha(#282a36, ${ao});
@define-color ac-txt ${activeBorder};
@define-color ic-txt ${inactiveBorder};
@define-color ac-bd alpha(${activeBorder}, ${ao});
@define-color ic-bd alpha(${inactiveBorder}, ${io});
@define-color accent #262626;
@define-color red #FF5555;
@define-color green #50fa7b;
@define-color yellow #f1fa8c;
@define-color orange #FFB86C;

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
  color: @ac-txt;
  font-size: 15px;
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

`
}

export function watchConfig(callback) {
  const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
    callback()
    return GLib.SOURCE_CONTINUE
  })

  return () => GLib.source_remove(timer)
}
