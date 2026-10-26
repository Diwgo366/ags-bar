import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { AGS_DIR, applyAppConfig } from "../config/appConfig.js"

const CONFIG_DIR = `${AGS_DIR}/src/config`
const watchedFiles = new Set(["appConfig.js", "privateConfig.js"])
const listeners = new Set()
const reloadTimers = new Map()
let monitor = null
let privateConfigModule = null

export function onConfigChange(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function notify(name, value) {
  for (const callback of listeners) {
    try {
      callback(name, value)
    } catch (error) {
      console.error(`Error aplicando cambios de ${name}:`, error)
    }
  }
}

function readFile(name) {
  const [ok, contents] = GLib.file_get_contents(`${CONFIG_DIR}/${name}`)
  if (!ok) throw new Error(`No se pudo leer ${name}`)
  return new TextDecoder().decode(contents)
}

function findObjectLiteral(source, name) {
  const declaration = new RegExp(`export\\s+(?:const|let)\\s+${name}\\s*=\\s*\\{`)
  const match = declaration.exec(source)
  if (!match) return null

  const start = source.indexOf("{", match.index)
  let depth = 0
  let quote = ""
  let escaped = false
  for (let index = start; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === quote) quote = ""
      continue
    }
    if (char === "\"" || char === "'") quote = char
    else if (char === "{") depth++
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1)
  }
  return null
}

function parseObjectLiteral(literal) {
  const json = literal
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/([,{]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, "$1")
  return JSON.parse(json)
}

function reloadAppConfig() {
  const source = readFile("appConfig.js")
  const updated = {}

  for (const name of ["TIME_FORMAT", "DATE_FORMAT", "INTERVAL", "OVERLAY", "CALENDAR"]) {
    const literal = findObjectLiteral(source, name)
    if (literal) updated[name] = parseObjectLiteral(literal)
  }

  for (const name of ["RUN_THEME_SCRIPTS", "LOCALE"]) {
    const expression = new RegExp(`export\\s+(?:const|let)\\s+${name}\\s*=\\s*(true|false|-?\\d+|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`)
    const match = source.match(expression)
    if (!match) continue
    updated[name] = match[1].startsWith("\"")
      ? JSON.parse(match[1])
      : match[1].startsWith("'")
        ? match[1].slice(1, -1).replace(/\\'/g, "'")
        : match[1] === "true"
          ? true
          : match[1] === "false"
            ? false
            : Number(match[1])
  }

  if (!Object.keys(updated).length) return
  applyAppConfig(updated)
  notify("appConfig", updated)
}

async function reloadPrivateConfig() {
  const source = readFile("privateConfig.js")
  const match = source.match(/calendarUrl\s*:\s*((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'))/)
  if (!match) return

  let calendarUrl
  if (match[1].startsWith('"')) calendarUrl = JSON.parse(match[1])
  else calendarUrl = match[1].slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\")

  if (!privateConfigModule) {
    privateConfigModule = await import("../config/privateConfig.js")
  }
  privateConfigModule.applyPrivateConfig({ calendarUrl })
  notify("privateConfig", { calendarUrl })
}

function scheduleReload(name) {
  const previousTimer = reloadTimers.get(name)
  if (previousTimer) GLib.source_remove(previousTimer)

  const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
    reloadTimers.delete(name)
    const reload = name === "appConfig.js" ? reloadAppConfig : reloadPrivateConfig
    Promise.resolve()
      .then(reload)
      .catch((error) => console.error(`No se pudo recargar ${name}:`, error))
    return GLib.SOURCE_REMOVE
  })
  reloadTimers.set(name, timer)
}

export async function watchConfigFiles() {
  if (monitor) return

  privateConfigModule = await import("../config/privateConfig.js")
  const directory = Gio.File.new_for_path(CONFIG_DIR)
  monitor = directory.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null)
  monitor.connect("changed", (_monitor, file, otherFile) => {
    const name = file?.get_basename()
    const movedName = otherFile?.get_basename()
    for (const candidate of watchedFiles) {
      if (name === candidate || movedName === candidate) scheduleReload(candidate)
    }
  })
}
