import GLib from "gi://GLib"
import { execAsync } from "ags/process"
import { AGS_DIR, RUN_THEME_SCRIPTS } from "../config/appConfig.js"

const THEME_SCRIPTS_DIR = `${AGS_DIR}/src/services/theme_scripts`

export async function runThemeScripts() {
  if (!RUN_THEME_SCRIPTS) return

  try {
    GLib.mkdir_with_parents(THEME_SCRIPTS_DIR, 0o755)
    const [ok, stdout, , status] = GLib.spawn_sync(
      null,
      ["find", THEME_SCRIPTS_DIR, "-maxdepth", "1", "-type", "f", "-name", "*.sh", "-print"],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null,
    )
    if (!ok || status !== 0) {
      throw new Error("No se pudieron listar los scripts de tema")
    }

    // GLib.spawn_sync exposes stdout as a NUL-terminated byte array, so use
    // newline-separated paths instead of find -print0 (which gets truncated).
    const scriptPaths = new TextDecoder()
      .decode(stdout)
      .trimEnd()
      .split("\n")
      .filter(Boolean)
      .sort()

    for (const scriptPath of scriptPaths) {
      try {
        await execAsync(["bash", scriptPath])
      } catch (error) {
        console.error(`Falló el script de tema ${scriptPath}:`, error)
      }
    }
  } catch (error) {
    console.error("Error ejecutando scripts de tema:", error)
  }
}
