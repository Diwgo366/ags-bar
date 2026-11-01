import Soup from "gi://Soup?version=3.0"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { INTERVAL } from "../../config/appConfig.js"

const session = new Soup.Session()
session.timeout = 15

const DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

const sourceCache = new Map()
const inflightRequests = new Map()
const failures = new Map()

export function clearCalendarCache() {
  sourceCache.clear()
  inflightRequests.clear()
  failures.clear()
}

export function pruneCalendarCache(sources) {
  const activeIds = new Set(sources.map((s) => s.id))
  for (const id of sourceCache.keys()) {
    if (!activeIds.has(id)) sourceCache.delete(id)
  }
  for (const id of inflightRequests.keys()) {
    if (!activeIds.has(id)) inflightRequests.delete(id)
  }
  for (const id of failures.keys()) {
    if (!activeIds.has(id)) failures.delete(id)
  }
}

function decodeICalString(str) {
  if (!str) return ""
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
}

function parseICalDate(dateStr, keyPart = "") {
  if (!dateStr) return null

  const clean = dateStr.trim()
  const isUtc = clean.endsWith("Z")
  const dateValue = isUtc ? clean.slice(0, -1) : clean
  const timeZoneMatch = keyPart.match(/TZID=([^;:]+)/i)
  const timeZone = timeZoneMatch ? timeZoneMatch[1] : null

  if (dateValue.length === 8) {
    const year = parseInt(dateValue.slice(0, 4))
    const month = parseInt(dateValue.slice(4, 6)) - 1
    const day = parseInt(dateValue.slice(6, 8))
    return new Date(year, month, day)
  }

  if (dateValue.length >= 15) {
    const year = parseInt(dateValue.slice(0, 4))
    const month = parseInt(dateValue.slice(4, 6)) - 1
    const day = parseInt(dateValue.slice(6, 8))
    const hour = parseInt(dateValue.slice(9, 11))
    const minute = parseInt(dateValue.slice(11, 13))
    const second = parseInt(dateValue.slice(13, 15))

    if (isUtc) return new Date(Date.UTC(year, month, day, hour, minute, second))

    // RFC 5545 floating times use local time. TZID times are also kept in the
    // calendar's wall clock zone so their displayed weekday/time stay aligned.
    if (timeZone) {
      const local = new Date(year, month, day, hour, minute, second)
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone,
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hourCycle: "h23",
        }).formatToParts(local)
        const values = Object.fromEntries(
          parts.map((part) => [part.type, part.value]),
        )
        const zonedAsLocal = new Date(
          Number(values.year),
          Number(values.month) - 1,
          Number(values.day),
          Number(values.hour),
          Number(values.minute),
          Number(values.second),
        )
        const correction = local.getTime() - zonedAsLocal.getTime()
        return new Date(local.getTime() + correction)
      } catch {
        // Unknown TZID: preserve the supplied wall-clock time in local time.
      }
    }

    return new Date(year, month, day, hour, minute, second)
  }

  return null
}

function parseRRule(rruleStr) {
  if (!rruleStr) return null
  const parts = {}
  for (const part of rruleStr.split(";")) {
    const [key, val] = part.split("=")
    parts[key] = val
  }

  const byday = parts.BYDAY
    ? parts.BYDAY.split(",")
        .map((d) => {
          const match = d.match(/^(-?\d)?(MO|TU|WE|TH|FR|SA|SU)$/)
          if (!match) return null
          return { nth: match[1] ? parseInt(match[1]) : null, day: match[2] }
        })
        .filter(Boolean)
    : null

  return {
    freq: parts.FREQ || "WEEKLY",
    interval: parseInt(parts.INTERVAL || "1"),
    count: parts.COUNT ? parseInt(parts.COUNT) : null,
    until: parts.UNTIL ? parseICalDate(parts.UNTIL) : null,
    wkst: parts.WKST || "MO",
    byday,
  }
}

function expandRRule(event, rrule, weekStart, weekEnd) {
  const occurrences = []
  const duration =
    event.end && event.start
      ? event.end.getTime() - event.start.getTime()
      : 3600000

  if (rrule.until && rrule.until < weekStart) return []

  if (rrule.count) {
    const msPerWeek = 7 * 86400000
    const totalWeeks = (rrule.count - 1) * (rrule.interval || 1)
    const lastOccurrence = new Date(
      event.start.getTime() + totalWeeks * msPerWeek,
    )
    if (lastOccurrence < weekStart) return []
  }

  if (event.start > weekEnd && !rrule.until && !rrule.count) return []

  if (rrule.freq === "WEEKLY") {
    const targetDays = rrule.byday
      ? rrule.byday.map((bd) => DAY_MAP[bd.day])
      : [event.start.getDay()]

    const interval = rrule.interval || 1
    const baseDate = new Date(event.start)
    const baseTime = baseDate.getTime()

    for (const targetDay of targetDays) {
      let current = new Date(weekStart)
      current.setHours(0, 0, 0, 0)
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1)
      }

      const firstPossible = new Date(current)
      firstPossible.setHours(
        baseDate.getHours(),
        baseDate.getMinutes(),
        baseDate.getSeconds(),
      )

      if (firstPossible < weekStart) {
        firstPossible.setDate(firstPossible.getDate() + 7 * interval)
      }

      const diffWeeks = Math.floor(
        (firstPossible.getTime() - baseTime) / (7 * 86400000),
      )
      if (diffWeeks < 0) continue
      if (diffWeeks % interval !== 0) {
        const adjust = ((interval - (diffWeeks % interval)) % interval) * 7
        firstPossible.setDate(firstPossible.getDate() + adjust)
      }

      for (
        let occ = new Date(firstPossible);
        occ <= weekEnd;
        occ.setDate(occ.getDate() + 7 * interval)
      ) {
        if (rrule.until && occ > rrule.until) break
        if (rrule.count) {
          const occIndex = Math.floor(
            (occ.getTime() - baseTime) / (7 * 86400000 * interval),
          )
          if (occIndex >= rrule.count) break
        }

        const occurrenceStart = new Date(occ)
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)
        occurrences.push({ start: occurrenceStart, end: occurrenceEnd })
      }
    }
  }

  return occurrences
}

function unfoldLines(content) {
  return content.replace(/\r?\n[ \t]/g, "")
}

function parseICalContent(content) {
  const rawEvents = []
  const lines = unfoldLines(content).split(/\r?\n/)
  let currentEvent = null

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentEvent = {}
    } else if (line === "END:VEVENT" && currentEvent) {
      if (currentEvent.start) {
        rawEvents.push(currentEvent)
      }
      currentEvent = null
    } else if (currentEvent) {
      const colonIndex = line.indexOf(":")
      if (colonIndex === -1) continue

      const keyPart = line.slice(0, colonIndex)
      const value = line.slice(colonIndex + 1)
      const key = keyPart.split(";")[0]

      switch (key) {
        case "DTSTART":
          currentEvent.start = parseICalDate(value, keyPart)
          break
        case "DTEND":
          currentEvent.end = parseICalDate(value, keyPart)
          break
        case "SUMMARY":
          currentEvent.summary = decodeICalString(value)
          break
        case "DESCRIPTION":
          currentEvent.description = decodeICalString(value)
          break
        case "LOCATION":
          currentEvent.location = decodeICalString(value)
          break
        case "STATUS":
          currentEvent.status = value
          break
        case "RRULE":
          currentEvent.rrule = parseRRule(value)
          break
        case "UID":
          currentEvent.uid = decodeICalString(value).trim()
          break
      }
    }
  }

  return rawEvents
}

function expandEvents(rawEvents, weekStart, weekEnd) {
  const expanded = []

  for (const event of rawEvents) {
    if (event.rrule) {
      const occurrences = expandRRule(event, event.rrule, weekStart, weekEnd)
      for (const occ of occurrences) {
        expanded.push({
          ...event,
          start: occ.start,
          end: occ.end,
          rrule: undefined,
        })
      }
    } else {
      expanded.push(event)
    }
  }

  return expanded
}

function getWeekRange(referenceDate = new Date()) {
  const dayOfWeek = referenceDate.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return { start: monday, end: sunday }
}

function isEventInWeek(event, weekStart, weekEnd) {
  if (!event.start) return false

  const eventStart = event.start
  const eventEnd = event.end || eventStart

  if (eventStart >= weekStart && eventStart <= weekEnd) return true
  if (eventEnd >= weekStart && eventEnd <= weekEnd) return true
  if (eventStart <= weekStart && eventEnd >= weekEnd) return true

  return false
}

function formatTime(date) {
  if (!date) return ""
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

function dateKey(date) {
  if (!date) return ""
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, "0")
  const d = date.getDate().toString().padStart(2, "0")
  return `${y}-${m}-${d}`
}

function sanitizeErrorMessage(error, status) {
  if (status && status !== 200) {
    return `HTTP ${status}`
  }
  if (error) {
    if (error.message === "Calendario no válido") {
      return "Calendario no válido"
    }
    if (
      (error.matches &&
        error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.TIMED_OUT)) ||
      /time.*out|agotado/i.test(error.message || "")
    ) {
      return "Tiempo de espera agotado"
    }
  }
  return "No se pudo conectar"
}

function loadSource(source) {
  return new Promise((resolve, reject) => {
    const url = typeof source?.url === "string" ? source.url.trim() : ""
    if (!url) {
      reject(new Error("Calendario no válido"))
      return
    }

    let msg = null
    try {
      msg = Soup.Message.new("GET", url)
    } catch {
      // Soup.Message.new may throw on invalid URL
    }

    if (!msg) {
      reject(new Error("Calendario no válido"))
      return
    }

    session.send_and_read_async(
      msg,
      GLib.PRIORITY_DEFAULT,
      null,
      (sess, result) => {
        try {
          const bytes = sess.send_and_read_finish(result)
          const status = msg.get_status()

          if (status !== 200) {
            const err = new Error(`HTTP ${status}`)
            err.status = status
            reject(err)
            return
          }

          const content = new TextDecoder().decode(bytes.get_data())
          const rawEvents = parseICalContent(content)
          for (const ev of rawEvents) {
            ev.sourceId = source.id
            ev.sourceName = source.name
            ev.sourceOrder = source.order
            ev.uid = ev.uid ? String(ev.uid).trim() : ""
          }
          resolve(rawEvents)
        } catch (e) {
          const status = msg.get_status()
          const err = new Error(sanitizeErrorMessage(e, status))
          err.status = status
          reject(err)
        }
      },
    )
  })
}

function getOrFetchSource(source) {
  const cached = sourceCache.get(source.id)
  const now = Date.now()
  const ttl =
    INTERVAL && typeof INTERVAL.CALENDAR === "number"
      ? INTERVAL.CALENDAR
      : 300000

  if (cached && now - cached.fetchedAt < ttl) {
    return Promise.resolve({
      rawEvents: cached.rawEvents,
      stale: false,
      error: null,
    })
  }

  if (inflightRequests.has(source.id)) {
    return inflightRequests.get(source.id)
  }

  const failure = failures.get(source.id)
  const cooldown = Math.min(
    INTERVAL && typeof INTERVAL.CALENDAR === "number"
      ? INTERVAL.CALENDAR
      : 300000,
    60000,
  )
  if (failure && now - failure.at < cooldown) {
    if (cached) {
      return Promise.resolve({
        rawEvents: cached.rawEvents,
        stale: true,
        error: failure.error,
      })
    }
    return Promise.reject(failure.error)
  }

  const promise = loadSource(source)
    .then((rawEvents) => {
      if (inflightRequests.get(source.id) !== promise)
        return { rawEvents: [], stale: false, error: null }
      sourceCache.set(source.id, { rawEvents, fetchedAt: Date.now() })
      inflightRequests.delete(source.id)
      failures.delete(source.id)
      return { rawEvents, stale: false, error: null }
    })
    .catch((err) => {
      inflightRequests.delete(source.id)
      if (cached) {
        failures.set(source.id, { error: err, at: Date.now() })
        return {
          rawEvents: cached.rawEvents,
          stale: true,
          error: err,
        }
      }
      failures.set(source.id, { error: err, at: Date.now() })
      throw err
    })

  inflightRequests.set(source.id, promise)
  return promise
}

function deduplicateEvents(events) {
  const seenByUidAndTime = new Set()
  const result = []

  for (const event of events) {
    if (!event.uid || !event.start) {
      result.push(event)
      continue
    }
    const key = `${event.uid}|${event.start.getTime()}`
    if (seenByUidAndTime.has(key)) {
      continue
    }
    seenByUidAndTime.add(key)
    result.push(event)
  }

  return result
}

function groupEventsByDay(weekEvents, weekStart) {
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
  const grouped = []
  const todayKey = dateKey(new Date())

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + i)
    const key = dateKey(day)

    const dayEvents = weekEvents.filter((e) => {
      if (!e.start) return false
      return dateKey(e.start) === key
    })

    grouped.push({
      name: dayNames[day.getDay()],
      date: day.getDate(),
      month: day.getMonth(),
      isToday: key === todayKey,
      events: dayEvents.map((e) => ({
        summary: e.summary || "(Sin título)",
        startTime: formatTime(e.start),
        endTime: formatTime(e.end),
        location: e.location || "",
        _rawDescription: e.description || "",
        _rawStart: e.start ? e.start.toISOString() : null,
        _rawEnd: e.end ? e.end.toISOString() : null,
        sourceId: e.sourceId || "",
        sourceName: e.sourceName || "",
        sourceOrder: e.sourceOrder ?? 0,
        uid: e.uid || "",
      })),
    })
  }

  return grouped
}

function createEmptyWeek(referenceDate = new Date()) {
  const { start: weekStart } = getWeekRange(referenceDate)
  return groupEventsByDay([], weekStart)
}

export async function fetchWeekEvents(
  sources = [],
  referenceDate = new Date(),
) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return {
      days: createEmptyWeek(referenceDate),
      errors: [],
      okCount: 0,
    }
  }

  const settled = await Promise.allSettled(
    sources.map((source) => getOrFetchSource(source)),
  )

  const errors = []
  let okCount = 0
  const allRawEvents = []

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]
    const res = settled[i]

    if (res.status === "fulfilled") {
      const { rawEvents, stale, error } = res.value
      okCount++
      allRawEvents.push(...rawEvents)
      if (stale && error) {
        const message = sanitizeErrorMessage(error, error.status)
        errors.push({
          sourceId: source.id,
          name: source.name,
          message,
          stale: true,
        })
      }
    } else {
      const err = res.reason
      const message = sanitizeErrorMessage(err, err?.status)
      errors.push({
        sourceId: source.id,
        name: source.name,
        message,
        stale: false,
      })
    }
  }

  const { start: weekStart, end: weekEnd } = getWeekRange(referenceDate)
  const allExpanded = expandEvents(allRawEvents, weekStart, weekEnd)

  const weekEvents = allExpanded
    .filter((e) => isEventInWeek(e, weekStart, weekEnd))
    .sort(
      (a, b) =>
        (a.start || 0) - (b.start || 0) ||
        (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0),
    )

  const deduplicatedEvents = deduplicateEvents(weekEvents)
  const days = groupEventsByDay(deduplicatedEvents, weekStart)

  return {
    days,
    errors,
    okCount,
  }
}
