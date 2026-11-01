import GLib from "gi://GLib"

export function normalizeCalendarSources(config) {
  try {
    if (!config || typeof config !== "object") return []

    let rawList = []
    if (Array.isArray(config.calendars)) {
      rawList = config.calendars
    } else if (
      typeof config.calendarUrl === "string" &&
      config.calendarUrl.trim().length > 0
    ) {
      rawList = [{ name: "Calendario", url: config.calendarUrl }]
    } else {
      return []
    }

    const result = []
    const seenUrls = new Set()

    for (const entry of rawList) {
      if (!entry || typeof entry !== "object") continue
      if (typeof entry.url !== "string") continue

      let url = entry.url.trim()
      if (!url) continue

      if (/^webcal:\/\//i.test(url)) {
        url = "https://" + url.slice(9)
      }

      if (!/^https?:\/\//i.test(url)) continue

      if (seenUrls.has(url)) continue
      seenUrls.add(url)

      const checksum = GLib.compute_checksum_for_string(
        GLib.ChecksumType.SHA256,
        url,
        -1,
      )
      const id = checksum ? checksum.slice(0, 12) : ""

      const rawName = entry.name != null ? String(entry.name).trim() : ""
      const order = result.length
      const name = rawName || `Calendario ${order + 1}`

      let color = null
      if (typeof entry.color === "string") {
        const trimmedColor = entry.color.trim()
        if (trimmedColor.startsWith("#")) {
          if (/^#[0-9a-fA-F]{6}$/.test(trimmedColor)) {
            color = trimmedColor
          }
        } else if (trimmedColor.length > 0) {
          color = trimmedColor
        }
      }

      result.push({
        id,
        name,
        url,
        color,
        order,
      })
    }

    return result
  } catch {
    return []
  }
}
