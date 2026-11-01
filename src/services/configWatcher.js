import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { AGS_DIR, applyAppConfig } from "../config/appConfig.js"
import { normalizeCalendarSources } from "./calendar/calendarSources.js"

const CONFIG_DIR = `${AGS_DIR}/src/config`
const watchedFiles = new Set(["appConfig.js", "privateConfig.js"])
const listeners = new Set()
const reloadTimers = new Map()
let monitor = null
let privateConfigModule = null

function loadPrivateConfig() {
  const path = `${CONFIG_DIR}/privateConfig.js`
  return import(GLib.filename_to_uri(path, null))
}

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

function stripComments(source) {
  let out = ""
  let inDouble = false
  let inSingle = false
  let inLine = false
  let inBlock = false
  let escaped = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    const next = i + 1 < source.length ? source[i + 1] : ""

    if (inLine) {
      if (char === "\n") {
        inLine = false
        out += "\n"
      }
      continue
    }

    if (inBlock) {
      if (char === "*" && next === "/") {
        inBlock = false
        i++
      }
      continue
    }

    if (inDouble) {
      out += char
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inDouble = false
      continue
    }

    if (inSingle) {
      out += char
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === "'") inSingle = false
      continue
    }

    if (char === "/" && next === "/") {
      inLine = true
      i++
      continue
    }
    if (char === "/" && next === "*") {
      inBlock = true
      i++
      continue
    }
    if (char === '"') inDouble = true
    else if (char === "'") inSingle = true
    out += char
  }

  return out
}

function findObjectLiteral(source, name) {
  const declaration = new RegExp(
    `export\\s+(?:const|let)\\s+${name}\\s*=\\s*\\{`,
  )
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
    if (char === '"' || char === "'") quote = char
    else if (char === "{") depth++
    else if (char === "}" && --depth === 0)
      return source.slice(start, index + 1)
  }
  return null
}

function parseObjectLiteral(stripped) {
  let json = ""
  let inDouble = false
  let inSingle = false
  let escaped = false

  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i]

    if (inDouble) {
      json += char
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inDouble = false
      continue
    }

    if (inSingle) {
      if (escaped) {
        escaped = false
        if (char === "'") json += "'"
        else if (char === "\\") json += "\\\\"
        else if (char === '"') json += '\\"'
        else json += "\\" + char
      } else if (char === "\\") {
        escaped = true
      } else if (char === "'") {
        json += '"'
        inSingle = false
      } else if (char === '"') {
        json += '\\"'
      } else if (char === "\n") {
        json += "\\n"
      } else if (char === "\r") {
        json += "\\r"
      } else if (char === "\t") {
        json += "\\t"
      } else {
        json += char
      }
      continue
    }

    if (char === '"') {
      inDouble = true
      json += char
      continue
    }

    if (char === "'") {
      inSingle = true
      json += '"'
      continue
    }

    if (/[a-zA-Z_$]/.test(char)) {
      let id = char
      let j = i + 1
      while (j < stripped.length && /[a-zA-Z0-9_$]/.test(stripped[j])) {
        id += stripped[j]
        j++
      }
      let k = j
      while (k < stripped.length && /\s/.test(stripped[k])) k++
      if (k < stripped.length && stripped[k] === ":") {
        json += '"' + id + '"'
      } else {
        json += id
      }
      i = j - 1
      continue
    }

    if (char === ",") {
      let k = i + 1
      while (k < stripped.length && /\s/.test(stripped[k])) k++
      if (k < stripped.length && (stripped[k] === "}" || stripped[k] === "]")) {
        continue
      }
    }

    json += char
  }

  return JSON.parse(json)
}

function reloadAppConfig() {
  const source = stripComments(readFile("appConfig.js"))
  const updated = {}

  for (const name of [
    "TIME_FORMAT",
    "DATE_FORMAT",
    "INTERVAL",
    "OVERLAY",
    "CALENDAR",
  ]) {
    const literal = findObjectLiteral(source, name)
    if (literal) updated[name] = parseObjectLiteral(literal)
  }

  const scalarNames = ["RUN_THEME_SCRIPTS", "RUN_WORKSPACES_SCRIPTS", "LOCALE"]
  for (let id = 1; id <= 10; id++) {
    scalarNames.push(`ws${id}_script`, `ws${id}_args`)
  }

  for (const name of scalarNames) {
    const expression = new RegExp(
      `export\\s+(?:const|let)\\s+${name}\\s*=\\s*(true|false|-?\\d+|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`,
    )
    const match = source.match(expression)
    if (!match) continue
    updated[name] = match[1].startsWith('"')
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
  let parsed
  try {
    const source = stripComments(readFile("privateConfig.js"))
    const literal = findObjectLiteral(source, "privateConfig")
    if (!literal) {
      console.error("No se pudo interpretar privateConfig.js")
      return
    }
    parsed = parseObjectLiteral(literal)
  } catch {
    console.error("No se pudo interpretar privateConfig.js")
    return
  }

  const sources = normalizeCalendarSources(parsed)

  if (!privateConfigModule) {
    privateConfigModule = await loadPrivateConfig()
  }
  if (
    privateConfigModule &&
    typeof privateConfigModule.applyPrivateConfig === "function"
  ) {
    privateConfigModule.applyPrivateConfig(parsed)
  }
  notify("privateConfig", { sources })
}

function scheduleReload(name) {
  const previousTimer = reloadTimers.get(name)
  if (previousTimer) GLib.source_remove(previousTimer)

  const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
    reloadTimers.delete(name)
    const reload =
      name === "appConfig.js" ? reloadAppConfig : reloadPrivateConfig
    Promise.resolve()
      .then(reload)
      .catch((error) => console.error(`No se pudo recargar ${name}:`, error))
    return GLib.SOURCE_REMOVE
  })
  reloadTimers.set(name, timer)
}

export async function watchConfigFiles() {
  if (monitor) return

  privateConfigModule = await loadPrivateConfig()
  const directory = Gio.File.new_for_path(CONFIG_DIR)
  monitor = directory.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null)
  monitor.connect("changed", (_monitor, file, otherFile) => {
    const name = file?.get_basename()
    const movedName = otherFile?.get_basename()
    for (const candidate of watchedFiles) {
      if (name === candidate || movedName === candidate)
        scheduleReload(candidate)
    }
  })
}
