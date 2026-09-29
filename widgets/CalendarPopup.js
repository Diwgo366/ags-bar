import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import { ICAL_URL, CALENDAR, INTERVAL } from "../config.js"
import { fetchWeekEvents } from "../utils/icalParser.js"

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  return Math.abs(hash)
}

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const courseColorCache = {}
const registeredCourses = new Set()
const usedHues = []

function getMaxDistanceHue() {
  if (usedHues.length === 0) {
    usedHues.push(0)
    return 0
  }
  let bestHue = 0
  let bestMinDist = 0
  for (let h = 0; h < 360; h += 5) {
    let minDist = 360
    for (const used of usedHues) {
      const d = Math.abs(h - used)
      const dist = Math.min(d, 360 - d)
      if (dist < minDist) minDist = dist
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist
      bestHue = h
    }
  }
  usedHues.push(bestHue)
  return bestHue
}

function getCourseColors(summary) {
  const name = summary.trim()
  if (courseColorCache[name]) return courseColorCache[name]

  const hue = getMaxDistanceHue()
  const bg = hslToHex(hue, 65, 55)
  const border = hslToHex(hue, 70, 35)
  const cssClass = `cal-course-${hashString(name)}`

  courseColorCache[name] = { bg, border, cssClass }
  return courseColorCache[name]
}

function registerCourseStyle(courseName) {
  if (registeredCourses.has(courseName)) return
  registeredCourses.add(courseName)

  const colors = getCourseColors(courseName)
  dynamicCSS += `.${colors.cssClass} { background-color: alpha(${colors.bg}, 0.85); border-left-color: ${colors.border}; }\n`
  dynamicStyleProvider.load_from_string(dynamicCSS)

  Gtk.StyleContext.add_provider_for_display(
    Gdk.Display.get_default(), dynamicStyleProvider,
    Gtk.STYLE_PROVIDER_PRIORITY_USER,
  )
}

function extractSalon(description) {
  if (!description) return ""
  const match = description.match(/[Ss]al[oó]n:\s*([^\n\\]+)/)
  return match ? match[1].trim() : ""
}

const dynamicStyleProvider = new Gtk.CssProvider()
let dynamicCSS = ""

function clearChildren(widget) {
  let child = widget.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    widget.remove(child)
    child = next
  }
}

function createCalendarGrid() {
  const mainBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
    css_classes: ["cal-popup"],
  })

  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  })

  const titleLabel = new Gtk.Label({
    label: "Mi Semana",
    halign: Gtk.Align.CENTER,
    hexpand: true,
    css_classes: ["cal-header"],
  })
  headerBox.append(titleLabel)

  const closeBtn = new Gtk.Button({
    label: "×",
    halign: Gtk.Align.END,
    css_classes: ["cal-close"],
  })
  headerBox.append(closeBtn)
  mainBox.append(headerBox)

  const scroll = new Gtk.ScrolledWindow({
    vexpand: true,
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.NEVER,
  })

  const grid = new Gtk.Grid({
    column_homogeneous: true,
    column_spacing: 0,
    row_spacing: 0,
  })
  scroll.set_child(grid)
  mainBox.append(scroll)

  function render(grouped) {
    clearChildren(grid)

    const emptyTop = new Gtk.Label({ label: "" })
    grid.attach(emptyTop, 0, 0, 1, 1)

    for (let d = 0; d < CALENDAR.NUM_DAYS; d++) {
      const day = grouped[d]
      const lbl = new Gtk.Label({
        label: `${day.name} ${day.date}`,
        hexpand: true,
        css_classes: day.isToday
          ? ["cal-day-header", "today"]
          : ["cal-day-header"],
      })
      grid.attach(lbl, d + 1, 0, 1, 1)
    }

    const occupied = {}

    const hours = CALENDAR.END_HOUR - CALENDAR.START_HOUR
    for (let h = 0; h <= hours; h++) {
      const hour = CALENDAR.START_HOUR + h

      const hourLabel = new Gtk.Label({
        label: `${hour.toString().padStart(2, "0")}:00`,
        css_classes: ["cal-hour-label"],
        halign: Gtk.Align.END,
        margin_end: 4,
      })
      grid.attach(hourLabel, 0, h + 1, 1, 1)

      for (let d = 0; d < CALENDAR.NUM_DAYS; d++) {
        if (occupied[`${d},${h}`]) continue

        const event = grouped[d].events.find(e => e.startHour === hour)

        if (event) {
          const colors = getCourseColors(event.summary)
          registerCourseStyle(event.summary)

          const eventBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ["cal-cell", "cal-event", colors.cssClass],
            hexpand: true,
            vexpand: true,
          })

          const timeLbl = new Gtk.Label({
            label: event.endTime
              ? `${event.startTime} - ${event.endTime}`
              : event.startTime,
            css_classes: ["cal-event-time"],
            halign: Gtk.Align.START,
          })
          eventBox.append(timeLbl)

          const titleLbl = new Gtk.Label({
            label: event.summary,
            css_classes: ["cal-event-title"],
            halign: Gtk.Align.START,
            ellipsize: 3,
            wrap: true,
          })
          eventBox.append(titleLbl)

          if (event.salon) {
            const salonLbl = new Gtk.Label({
              label: event.salon,
              css_classes: ["cal-event-salon"],
              halign: Gtk.Align.START,
            })
            eventBox.append(salonLbl)
          }

          const span = event.duration || 1
          grid.attach(eventBox, d + 1, h + 1, 1, span)

          for (let s = 0; s < span; s++) {
            occupied[`${d},${h + s}`] = true
          }
        } else {
          const empty = new Gtk.Box({
            css_classes: ["cal-cell"],
            hexpand: true,
          })
          empty.set_size_request(-1, CALENDAR.HOUR_HEIGHT)
          grid.attach(empty, d + 1, h + 1, 1, 1)
        }
      }
    }
  }

  function showLoading() {
    clearChildren(grid)
    const loading = new Gtk.Label({
      label: "Cargando eventos...",
      margin_top: 20,
      margin_bottom: 20,
    })
    grid.attach(loading, 0, 0, CALENDAR.NUM_DAYS + 1, 1)
  }

  function showError(msg) {
    clearChildren(grid)
    const error = new Gtk.Label({
      label: `Error: ${msg}`,
      margin_top: 20,
      margin_bottom: 20,
    })
    grid.attach(error, 0, 0, CALENDAR.NUM_DAYS + 1, 1)
  }

  return { mainBox, closeBtn, render, showLoading, showError }
}

function enrichEvents(grouped) {
  for (const day of grouped) {
    day.events = day.events.map(e => {
      const start = new Date(e._rawStart)
      const end = e._rawEnd ? new Date(e._rawEnd) : null

      const startHour = start.getHours()
      const startMin = start.getMinutes()
      const endHour = end ? end.getHours() : startHour + 1
      const endMin = end ? end.getMinutes() : 0

      const durationMin = (endHour * 60 + endMin) - (startHour * 60 + startMin)
      const duration = Math.max(1, Math.ceil(durationMin / 60))

      return {
        summary: e.summary,
        startTime: `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}`,
        endTime: end ? `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}` : "",
        startHour,
        duration,
        location: e.location,
        salon: extractSalon(e._rawDescription),
      }
    })
  }
  return grouped
}

function createCalendarPopup() {
  const { mainBox, closeBtn, render, showLoading, showError } = createCalendarGrid()

  const window = new Astal.Window({
    name: "calendar-popup",
    layer: Astal.Layer.TOP,
    exclusivity: Astal.Exclusivity.IGNORE,
    visible: false,
    keymode: Astal.Keymode.ON_DEMAND,
    application: app,
    child: mainBox,
    width_request: 540,
    height_request: 600,
  })

  closeBtn.connect("clicked", () => {
    window.visible = false
  })

  let lastFetch = 0

  function refresh() {
    const now = Date.now()
    if (now - lastFetch < INTERVAL.CALENDAR) return

    showLoading()

    fetchWeekEvents(ICAL_URL)
      .then(grouped => {
        const enriched = enrichEvents(grouped)
        render(enriched)
        lastFetch = Date.now()
      })
      .catch(e => {
        showError(e.message || "No se pudo cargar el calendario")
      })
  }

  function show() {
    refresh()
    window.visible = true
  }

  function hide() {
    window.visible = false
  }

  function toggle() {
    if (window.visible) {
      hide()
    } else {
      show()
    }
  }

  return { window, show, hide, toggle, refresh }
}

let instance = null

export function getCalendarPopup() {
  if (!instance) instance = createCalendarPopup()
  return instance
}
