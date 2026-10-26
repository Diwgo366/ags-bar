import app from "ags/gtk4/app"
import { Astal, Gdk } from "ags/gtk4"
import Bar from "./bar/Bar.tsx"
import Overlay from "./widgets/Overlay.tsx"
import { configureCalendarPopup } from "./widgets/CalendarPopup.tsx"
import ThemeSelector from "./widgets/ThemeSelector.tsx"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { applyTheme } from "./themes/theme.css.js"
import { AGS_DIR } from "./config/appConfig.js"
import { runThemeScripts } from "./services/themeScripts.js"
import { onConfigChange, watchConfigFiles } from "./services/configWatcher.js"

const privateConfigPath = AGS_DIR + "/src/config/privateConfig.js"
if (!GLib.file_test(privateConfigPath, GLib.FileTest.EXISTS)) {
  const content = [
    "// Auto-generado - edita este archivo directamente",
    "// Se regenera con valores por defecto si lo borras",
    "",
    "export let privateConfig = {",
    '  calendarUrl: "",',
    "};",
    "export function applyPrivateConfig(updated) {",
    "  privateConfig = { ...privateConfig, ...updated };",
    "}",
    "",
  ].join("\n")
  GLib.file_set_contents(privateConfigPath, content)
}
// Keep this as a runtime import: AGS bundles this entry before executing it,
// so the generated, git-ignored file does not exist during bundle resolution.
const privateConfigUri = GLib.filename_to_uri(privateConfigPath, null)
const { privateConfig } = await import(privateConfigUri)

const activeThemePath = AGS_DIR + "/src/themes/theme.json"
if (!GLib.file_test(activeThemePath, GLib.FileTest.EXISTS)) {
  const defaultThemePath = AGS_DIR + "/src/themes/themes/default.json"
  const [ok, content] = GLib.file_get_contents(defaultThemePath)
  if (!ok)
    throw new Error(
      `No se pudo leer el tema predeterminado: ${defaultThemePath}`,
    )
  GLib.file_set_contents(activeThemePath, content)
}

await applyTheme()
await runThemeScripts()

app.start({
  css: "",
  main() {
    // Keep wallpaper updates available regardless of which Hyprland script
    // started AGS. The daemon's lock makes a manually started copy harmless.
    void execAsync(["bash", AGS_DIR + "/src/services/wallpaper-daemon.sh"]).catch((error) =>
      console.error("No se pudo iniciar wallpaper-daemon:", error),
    )

    const monitors = app.get_monitors()
    const primaryMonitor =
      monitors.find((monitor) => monitor.get_connector() === "eDP-1") ??
      monitors[0]
    const windows = primaryMonitor ? [Bar(primaryMonitor)] : []

    const overlay = Overlay()
    configureCalendarPopup(privateConfig.calendarUrl)
    void watchConfigFiles().catch((error) =>
      console.error("No se pudo iniciar el vigilante de configuración:", error),
    )
    onConfigChange((name, value) => {
      if (name === "privateConfig") configureCalendarPopup(value.calendarUrl)
    })
    const themeSelector = ThemeSelector()

    return [
      ...windows,
      overlay.window,
      themeSelector.window,
    ]
  },
  requestHandler(args, response) {
    if (!args.length) return
    if (args[0] === "toggle" && args[1]) {
      const win = app.get_window(args[1])
      if (win) {
        win.visible = !win.visible
        response("toggled")
      } else {
        response("window not found: " + args[1])
      }
    } else if (args[0] === "kill-daemon") {
      execAsync("pkill -f wallpaper-daemon.sh")
      response("daemon killed")
    } else {
      response("unknown command: " + args.join(" "))
    }
  },
})
