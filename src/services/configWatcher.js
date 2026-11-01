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

function parseObjectLiteral(literal) {
  let clean = ""
  let inDouble = false
  let inSingle = false
  let inLineComment = false
  let inBlockComment = false
  let escaped = false

  for (let i = 0; i < literal.length; i++) {
    const char = literal[i]
    const next = i + 1 < literal.length ? literal[i + 1] : ""

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false
        clean += "\n"
      }
      continue
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false
        i++
      }
      continue
    }

    if (inDouble) {
      clean += char
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inDouble = false
      continue
    }

    if (inSingle) {
      clean += char
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === "'") inSingle = false
      continue
    }

    if (char === "/" && next === "/") {
      inLineComment = true
      i++
      continue
    }
    if (char === "/" && next === "*") {
      inBlockComment = true
      i++
      continue
    }
    if (char === '"') {
      inDouble = true
      clean += char
      continue
    }
    if (char === "'") {
      inSingle = true
      clean += char
      continue
    }
    clean += char
  }

  let withDoubleStrings = ""
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (char === '"') {
      withDoubleStrings += '"'
      i++
      let esc = false
      while (i < clean.length) {
        const c = clean[i]
        withDoubleStrings += c
        if (esc) esc = false
        else if (c === "\\") esc = true
        else if (c === '"') break
        i++
      }
      continue
    }

    if (char === "'") {
      withDoubleStrings += '"'
      i++
      let esc = false
      while (i < clean.length) {
        const c = clean[i]
        if (esc) {
          if (c === "'") withDoubleStrings += "'"
          else if (c === "\\") withDoubleStrings += "\\\\"
          else if (c === '"') withDoubleStrings += '\\"'
          else withDoubleStrings += "\\" + c
          esc = false
        } else if (c === "\\") {
          esc = true
        } else if (c === "'") {
          withDoubleStrings += '"'
          break
        } else if (c === '"') {
          withDoubleStrings += '\\"'
        } else if (c === "\n") {
          withDoubleStrings += "\\n"
        } else if (c === "\r") {
          withDoubleStrings += "\\r"
        } else if (c === "\t") {
          withDoubleStrings += "\\t"
        } else {
          withDoubleStrings += c
        }
        i++
      }
      continue
    }

    withDoubleStrings += char
  }

  let json = ""
  for (let i = 0; i < withDoubleStrings.length; i++) {
    const char = withDoubleStrings[i]

    if (char === '"') {
      json += '"'
      i++
      let esc = false
      while (i < withDoubleStrings.length) {
        const c = withDoubleStrings[i]
        json += c
        if (esc) esc = false
        else if (c === "\\") esc = true
        else if (c === '"') break
        i++
      }
      continue
    }

    if (/[a-zA-Z_$]/.test(char)) {
      let id = char
      let j = i + 1
      while (
        j < withDoubleStrings.length &&
        /[a-zA-Z0-9_$]/.test(withDoubleStrings[j])
      ) {
        id += withDoubleStrings[j]
        j++
      }
      let k = j
      while (k < withDoubleStrings.length && /\s/.test(withDoubleStrings[k])) {
        k++
      }
      if (k < withDoubleStrings.length && withDoubleStrings[k] === ":") {
        json += '"' + id + '"'
        i = j - 1
        continue
      } else {
        json += id
        i = j - 1
        continue
      }
    }

    if (char === ",") {
      let k = i + 1
      while (k < withDoubleStrings.length && /\s/.test(withDoubleStrings[k])) {
        k++
      }
      if (
        k < withDoubleStrings.length &&
        (withDoubleStrings[k] === "}" || withDoubleStrings[k] === "]")
      ) {
        continue
      }
    }

    json += char
  }

  return JSON.parse(json)
}

function reloadAppConfig() {
  const source = readFile("appConfig.js")
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
    const source = readFile("privateConfig.js")
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
