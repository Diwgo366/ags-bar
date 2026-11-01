import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { CALENDAR, INTERVAL, LOCALE } from "../config/appConfig.js"
import { fetchWeekEvents } from "../services/calendar/icalParser.js"
import { onConfigChange } from "../services/configWatcher.js"
import {
  clearCalendarStyles,
  getThemeColors,
  onThemeChange,
  registerCalendarStyle,
} from "../themes/theme.css.js"

export type Source = {
  id: string
  name: string
  url: string
  order: number
}

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  return Math.abs(hash)
}

const courseColorCache: Record<string, { bg: string; cssClass: string }> = {}
const registeredCourses = new Set<string>()
const colorSlots = new Map<string, number>()

function clearCourseColorCache() {
  for (const name of Object.keys(courseColorCache)) {
    delete courseColorCache[name]
  }
  registeredCourses.clear()
  clearCalendarStyles()
}

const themeColorNames = [
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "red_s",
  "green_s",
  "yellow_s",
  "blue_s",
  "magenta_s",
  "cyan_s",
] as const

function getCourseColors(summary: string, sourceId = "") {
  const key = `${sourceId}|${summary.trim()}`
  if (courseColorCache[key]) return courseColorCache[key]

  if (!colorSlots.has(key)) {
    colorSlots.set(key, colorSlots.size)
  }
  const slot = colorSlots.get(key)!

  const colors = getThemeColors()
  const colorName = themeColorNames[slot % themeColorNames.length]
  const bg = colors[colorName]
  const cssClass = `cal-course-${hashString(key)}`

  courseColorCache[key] = { bg, cssClass }
  return courseColorCache[key]
}

function registerCourseStyle(
  key: string,
  colors: { bg: string; cssClass: string },
) {
  if (registeredCourses.has(key)) return
  registeredCourses.add(key)
  registerCalendarStyle(colors.cssClass, colors.bg)
}

function extractSalon(description: string, location: string) {
  if (!description && !location) return ""
  const str = String(description || "")
  const loc = String(location || "")

  const patterns = [
    /[Ss]al[oó]n:\s*([^\n]+)/,
    /[Aa]ula:\s*([^\n]+)/,
    /[Rr]oom:\s*([^\n]+)/,
    /[Ss]ala:\s*([^\n]+)/,
  ]

  for (const pattern of patterns) {
    const match = str.match(pattern)
    if (match) return match[1].trim()
  }

  if (loc && !loc.includes(",") && loc.length < 50) return loc.trim()

  return ""
}

function clearChildren(widget: Gtk.Widget) {
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

  const weekOffset = { value: 0 }

  const previousWeek = new Gtk.Button({
    label: "‹",
    css_classes: ["cal-week-nav"],
  })
  headerBox.append(previousWeek)

  const titleLabel = new Gtk.Label({
    label: "Calendario",
    halign: Gtk.Align.CENTER,
    hexpand: true,
    css_classes: ["cal-header"],
  })
  headerBox.append(titleLabel)

  const warningImage = new Gtk.Image({
    icon_name: "dialog-warning-symbolic",
    pixel_size: 18,
    valign: Gtk.Align.CENTER,
    css_classes: ["cal-warning"],
    visible: false,
  })
  headerBox.append(warningImage)

  const nextWeek = new Gtk.Button({
    label: "›",
    css_classes: ["cal-week-nav"],
  })
  headerBox.append(nextWeek)

  mainBox.append(headerBox)

  const scroll = new Gtk.ScrolledWindow({
    vexpand: true,
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.NEVER,
  })

  const grid = new Gtk.Grid({
    column_homogeneous: false,
    row_homogeneous: true,
    column_spacing: 0,
    row_spacing: 0,
  })
  scroll.set_child(grid)
  mainBox.append(scroll)

  const nowLine = new Gtk.Box({
    css_classes: ["cal-now-line"],
    valign: Gtk.Align.START,
    margin_top: -1,
  })
  nowLine.set_can_target(false)
  nowLine.set_visible(false)
  function updateNowLine() {
    const now = new Date()
    const today = now.getDay()
    const dayIndex = today === 0 ? 6 : today - 1
    const hour = now.getHours() + now.getMinutes() / 60
    if (
      dayIndex < 0 ||
      dayIndex >= CALENDAR.NUM_DAYS ||
      hour < CALENDAR.START_HOUR ||
      hour >= CALENDAR.END_HOUR
    ) {
      nowLine.set_visible(false)
      return
    }

    const row = Math.floor(hour - CALENDAR.START_HOUR)
    const rowLabel = grid.get_child_at(0, row + 1)
    const allocatedRowHeight = rowLabel?.get_allocated_height() ?? 0
    const rowHeight = Math.max(allocatedRowHeight, CALENDAR.HOUR_HEIGHT)
    nowLine.set_margin_top(
      Math.round(((hour - CALENDAR.START_HOUR) % 1) * rowHeight),
    )
    if (nowLine.get_parent()) grid.remove(nowLine)
    grid.attach(nowLine, dayIndex + 1, row + 1, 1, 1)
    nowLine.set_visible(true)
  }

  function queueNowLineUpdate() {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      if (weekOffset.value === 0) updateNowLine()
      return GLib.SOURCE_REMOVE
    })
  }

  function renderGrid() {
    clearChildren(grid)

    const emptyTop = new Gtk.Label({ label: "" })
    grid.attach(emptyTop, 0, 0, 1, 1)

    const now = new Date()
    const reference = new Date(now)
    reference.setDate(reference.getDate() + weekOffset.value * 7)
    const today = reference.getDay()
    const mondayOffset = today === 0 ? -6 : 1 - today
    const monday = new Date(reference)
    monday.setDate(reference.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    titleLabel.set_label(
      `${monday.toLocaleDateString(LOCALE, { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" })}`,
    )

    for (let d = 0; d < CALENDAR.NUM_DAYS; d++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + d)
      const dayName = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
        date.getDay()
      ]
      const dayStr = date.toLocaleDateString(LOCALE, {
        day: "2-digit",
        month: "2-digit",
      })
      const isToday =
        weekOffset.value === 0 && date.toDateString() === now.toDateString()
      const lbl = new Gtk.Label({
        label: `${dayName} ${dayStr}`,
        hexpand: true,
        css_classes: isToday ? ["cal-day-header", "today"] : ["cal-day-header"],
      })
      grid.attach(lbl, d + 1, 0, 1, 1)
    }

    const hours = CALENDAR.END_HOUR - CALENDAR.START_HOUR
    for (let h = 0; h < hours; h++) {
      const hour = CALENDAR.START_HOUR + h

      const hourLabel = new Gtk.Label({
        label: `${hour.toString().padStart(2, "0")}:00`,
        css_classes: ["cal-hour-label"],
        halign: Gtk.Align.END,
        valign: Gtk.Align.START,
        margin_end: 4,
      })
      grid.attach(hourLabel, 0, h + 1, 1, 1)

      for (let d = 0; d < CALENDAR.NUM_DAYS; d++) {
        const empty = new Gtk.Box({
          css_classes: ["cal-cell"],
          hexpand: true,
        })
        empty.set_size_request(120, CALENDAR.HOUR_HEIGHT)
        grid.attach(empty, d + 1, h + 1, 1, 1)
      }
    }

    if (weekOffset.value === 0) updateNowLine()
    else nowLine.set_visible(false)
    queueNowLineUpdate()
  }

  function renderEvents(grouped: any[], currentSources: Source[] = []) {
    const occupied: Record<string, boolean> = {}

    const hours = CALENDAR.END_HOUR - CALENDAR.START_HOUR
    const eventsByHour = grouped.map((day: any) => {
      const byHour = new Map<number, any>()
      for (const event of day.events) {
        if (!byHour.has(event.startHour)) byHour.set(event.startHour, event)
      }
      return byHour
    })

    for (let h = 0; h <= hours; h++) {
      const hour = CALENDAR.START_HOUR + h
      if (hour >= CALENDAR.END_HOUR) continue
      for (let d = 0; d < CALENDAR.NUM_DAYS; d++) {
        if (occupied[`${d},${h}`]) continue

        const event = eventsByHour[d]?.get(hour)

        if (event) {
          const colors = getCourseColors(event.summary, event.sourceId)
          const colorKey = `${event.sourceId || ""}|${event.summary.trim()}`
          registerCourseStyle(colorKey, colors)
          const span = Math.min(event.duration || 1, hours - h)

          const eventBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ["cal-cell", "cal-event", colors.cssClass],
            hexpand: false,
            vexpand: true,
          })
          eventBox.set_size_request(120, span * CALENDAR.HOUR_HEIGHT)

          const timeLine = event.endTime
            ? `\n${event.startTime} - ${event.endTime}`
            : ""
          eventBox.set_tooltip_text(
            `${event.sourceName}\n${event.summary}${timeLine}`,
          )

          const titleLbl = new Gtk.Label({
            label: event.summary,
            css_classes: ["cal-event-title"],
            halign: Gtk.Align.START,
            ellipsize: 3,
            wrap: false,
          })
          eventBox.append(titleLbl)

          if (span > 1 && CALENDAR.SHOW_HOUR) {
            const timeLbl = new Gtk.Label({
              label: event.endTime
                ? `${event.startTime} - ${event.endTime}`
                : event.startTime,
              css_classes: ["cal-event-time"],
              halign: Gtk.Align.START,
            })
            eventBox.prepend(timeLbl)
          }

          if (span > 1 && CALENDAR.SHOW_EXTRA && event.salon) {
            const salonLbl = new Gtk.Label({
              label: event.salon,
              css_classes: ["cal-event-salon"],
              halign: Gtk.Align.START,
            })
            eventBox.append(salonLbl)
          }

          const child = grid.get_child_at(d + 1, h + 1)
          if (child) grid.remove(child)
          grid.attach(eventBox, d + 1, h + 1, 1, span)

          for (let s = 0; s < span; s++) {
            occupied[`${d},${h + s}`] = true
          }
        }
      }
    }

    if (weekOffset.value === 0) updateNowLine()
    else nowLine.set_visible(false)
    queueNowLineUpdate()
  }

  function showLoading() {
    setWarning([])
    clearChildren(grid)
    const loading = new Gtk.Label({
      label: "Cargando eventos...",
      margin_top: 20,
      margin_bottom: 20,
    })
    grid.attach(loading, 0, 0, CALENDAR.NUM_DAYS + 1, 1)
  }

  function showError(msg: string) {
    setWarning([])
    clearChildren(grid)
    const error = new Gtk.Label({
      label: `Error: ${String(msg || "No se pudo cargar el calendario")}`,
      margin_top: 20,
      margin_bottom: 20,
    })
    grid.attach(error, 0, 0, CALENDAR.NUM_DAYS + 1, 1)
  }

  function setWarning(
    errors: Array<{
      sourceId: string
      name: string
      message: string
      stale: boolean
    }>,
  ) {
    if (errors && errors.length > 0) {
      const tooltip = errors
        .map(
          (e) =>
            `${e.name}: ${e.message}${e.stale ? " (datos desactualizados)" : ""}`,
        )
        .join("\n")
      warningImage.set_tooltip_text(tooltip)
      warningImage.set_visible(true)
    } else {
      warningImage.set_visible(false)
    }
  }

  return {
    mainBox,
    previousWeek,
    nextWeek,
    weekOffset,
    renderGrid,
    renderEvents,
    showLoading,
    showError,
    setWarning,
    updateNowLine,
  }
}

function enrichEvents(grouped: any[]) {
  for (const day of grouped) {
    day.events = day.events.map((e: any) => {
      const start = new Date(e._rawStart)
      const end = e._rawEnd ? new Date(e._rawEnd) : null

      const startHour = start.getHours()
      const startMin = start.getMinutes()
      const endHour = end ? end.getHours() : startHour + 1
      const endMin = end ? end.getMinutes() : 0

      const durationMin = end ? end.getTime() - start.getTime() : 60 * 60 * 1000
      const duration = Math.max(
        1,
        Math.ceil((startMin + durationMin / 60000) / 60),
      )

      return {
        summary: e.summary,
        startTime: `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}`,
        endTime: end
          ? `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`
          : "",
        startHour,
        startMin,
        duration,
        location: e.location,
        salon: extractSalon(e._rawDescription, e.location),
        sourceId: e.sourceId || "",
        sourceName: e.sourceName || "",
        sourceOrder: e.sourceOrder ?? 0,
        uid: e.uid || "",
      }
    })
  }
  return grouped
}

function createCalendarPopup(initialSources: Source[] = []) {
  let sources: Source[] = initialSources

  const {
    mainBox,
    previousWeek,
    nextWeek,
    weekOffset,
    renderGrid,
    renderEvents,
    showLoading,
    showError,
    setWarning,
    updateNowLine,
  } = createCalendarGrid()

  const popover = new Gtk.Popover()
  popover.set_autohide(true)
  popover.set_has_arrow(false)
  popover.set_position(Gtk.PositionType.BOTTOM)
  popover.set_offset(0, 8)
  popover.add_css_class("calendar-popover")
  popover.set_child(mainBox)
  popover.set_size_request(540, 600)

  let lastEnriched: any[] | null = null

  function navigateWeek(offset: number) {
    weekOffset.value += offset
    lastEnriched = null
    show()
  }

  previousWeek.connect("clicked", () => navigateWeek(-1))
  nextWeek.connect("clicked", () => navigateWeek(1))

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60_000, () => {
    if (popover.get_visible() && weekOffset.value === 0) updateNowLine()
    return GLib.SOURCE_CONTINUE
  })

  function refresh() {
    if (!sources || sources.length === 0) {
      showError("Configura calendars en src/config/privateConfig.js")
      return
    }

    const referenceDate = new Date()
    referenceDate.setDate(referenceDate.getDate() + weekOffset.value * 7)

    fetchWeekEvents(sources, referenceDate)
      .then((result: any) => {
        if (result.okCount === 0) {
          const errorMsg =
            result.errors && result.errors.length > 0
              ? result.errors
                  .map((e: any) => `${e.name}: ${e.message}`)
                  .join("\n")
              : "No se pudo cargar el calendario"
          showError(errorMsg)
          return
        }

        const enriched = enrichEvents(result.days)
        lastEnriched = enriched
        renderGrid()
        renderEvents(enriched, sources)
        setWarning(result.errors || [])
      })
      .catch(() => {
        showError("No se pudo cargar el calendario")
      })
  }

  function show() {
    renderGrid()
    refresh()
    popover.popup()
  }

  function hide() {
    popover.popdown()
  }

  function setCalendarSources(newSources: Source[]) {
    sources = newSources
    lastEnriched = null
    clearCourseColorCache()
    if (popover.get_visible()) {
      showLoading()
      refresh()
    }
  }

  function toggle() {
    if (popover.get_visible()) {
      hide()
    } else {
      show()
    }
  }

  onThemeChange(() => {
    clearCourseColorCache()
    if (popover.get_visible() && lastEnriched) {
      renderGrid()
      renderEvents(lastEnriched, sources)
    }
  })

  onConfigChange((name) => {
    if (name !== "appConfig") return
    if (!popover.get_visible()) return
    renderGrid()
    if (lastEnriched) renderEvents(lastEnriched, sources)
  })

  function setAnchor(anchor: Gtk.Widget) {
    const parent = popover.get_parent()
    if (parent === anchor) return
    if (parent) popover.unparent()
    const overlayAnchor = anchor as Gtk.Overlay
    overlayAnchor.add_overlay(popover)
  }

  return { toggle, setCalendarSources, setAnchor }
}

let instance: ReturnType<typeof createCalendarPopup> | null = null
let configuredCalendarSources: Source[] = []

export function configureCalendarPopup(sources: Source[]) {
  configuredCalendarSources = sources
  instance?.setCalendarSources(sources)
}

export function getCalendarPopup(sources?: Source[]) {
  if (!instance) {
    instance = createCalendarPopup(sources ?? configuredCalendarSources)
  } else if (sources !== undefined) {
    instance.setCalendarSources(sources)
  }
  return instance
}
