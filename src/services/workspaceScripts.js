import GLib from "gi://GLib"
import { execAsync } from "ags/process"
import {
  AGS_DIR,
  RUN_WORKSPACES_SCRIPTS,
  getWorkspaceScriptConfig,
} from "../config/appConfig.js"

const WORKSPACE_SCRIPTS_DIR = `${AGS_DIR}/src/services/workspace_scripts`

export async function runWorkspaceScript(workspaceId) {
  if (!RUN_WORKSPACES_SCRIPTS) return

  const { script, args: argsText } = getWorkspaceScriptConfig(workspaceId)
  const scriptName = script.trim()
  if (!scriptName) return

  if (
    scriptName.includes("/") ||
    scriptName.includes("..") ||
    !scriptName.endsWith(".sh")
  ) {
    console.warn(`Script inválido para el workspace ${workspaceId}: ${scriptName}`)
    return
  }

  const scriptPath = `${WORKSPACE_SCRIPTS_DIR}/${scriptName}`
  if (!GLib.file_test(scriptPath, GLib.FileTest.IS_REGULAR)) {
    console.warn(`No existe el script del workspace ${workspaceId}: ${scriptPath}`)
    return
  }

  let args = []
  if (argsText.trim()) {
    try {
      const [, parsedArgs] = GLib.shell_parse_argv(argsText)
      args = parsedArgs ?? []
    } catch (error) {
      console.error(`Argumentos inválidos para el workspace ${workspaceId}:`, error)
      return
    }
  }

  try {
    await execAsync(["bash", scriptPath, ...args])
  } catch (error) {
    console.error(`Falló el script del workspace ${workspaceId}:`, error)
  }
}
