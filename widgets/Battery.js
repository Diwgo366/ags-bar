import { createBinding, createComputed, createState } from "ags"
import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import Bat from "gi://AstalBattery"
import { INTERVAL } from "../config.js"

const battery = Bat.get_default()

function batteryIcon(pct, charging, profile) {
  const level = Math.round(pct * 100)
  const rounded = Math.floor(level / 10) * 10
  const padded = String(rounded).padStart(3, "0")
  const chg = charging ? "-charging" : ""

  if (profile === "none")
    return `battery-${padded}${chg}`

  return `battery-${padded}${chg}-profile-${profile}`
}

const PROFILES = [
  ["Ahorro", "powersave", "sudo tlp power-saver"],
  ["Balanceado", "balanced", "sudo tlp balanced"],
  ["Rendimiento", "performance", "sudo tlp performance"],
]

function createProfilePopover(parent, profile, setProfile) {
  const popover = new Gtk.Popover()
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL})
  const rows = new Map()
  function updateActiveProfile(current = profile()) {
    for (const [id, { btn, indicator }] of rows) {
      const active = id === current
      btn.set_active(active)
      indicator.set_opacity(active ? 1 : 0)
    }
  }

  for (const [label, id, cmd] of PROFILES) {
    const btn = new Gtk.ToggleButton()
    const hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL})
    const indicator = new Gtk.Image({
      icon_name: "object-select-symbolic",
      pixel_size: 16,
    })
    const lbl = new Gtk.Label({ label, xalign: 0 })

    hbox.append(indicator)
    hbox.append(lbl)
    btn.set_child(hbox)
    btn.connect("clicked", () => {
      updateActiveProfile(id)
      setProfile(id)
      popover.popdown()
      execAsync(["bash", "-c", cmd])
    })
    rows.set(id, { btn, indicator })
    box.append(btn)
  }

  updateActiveProfile()
  const unsubscribe = profile.subscribe(updateActiveProfile)
  parent.connect("destroy", unsubscribe)

  popover.set_child(box)
  return popover
}

export default function Battery() {
  if (!battery?.get_is_present()) return <box />

  const percentage = createBinding(battery, "percentage")
  const charging = createBinding(battery, "charging")

  function getRealProfile() {
    try {
      const [ok, out] = GLib.spawn_command_line_sync("sh -c \"tlp-stat -s | grep 'TLP profile' | awk -F'= ' '{print $2}'\"")
      if (ok && out) {
        const val = new TextDecoder().decode(out).trim().toLowerCase()
        if (val.includes("saver") || val.includes("bat")) return "powersave"
        if (val.includes("balanced")) return "balanced"
        if (val.includes("performance") || val.includes("ac")) return "performance"
      }
    } catch {}
    return "balanced"
  }

  const tlpProfile = createPoll("balanced", INTERVAL.BATTERY_PROFILE, () => {
    return getRealProfile()
  })
  const [selectedProfile, setSelectedProfile] = createState(tlpProfile())
  const unsubscribeProfile = tlpProfile.subscribe(() => {
    setSelectedProfile(tlpProfile())
  })

  const iconName = createComputed(() =>
    batteryIcon(percentage(), charging(), selectedProfile())
  )

  return (
    <menubutton
      class="right-item"
      $={self => {
        const popover = createProfilePopover(self, selectedProfile, setSelectedProfile)
        self.set_popover(popover)
        self.connect("destroy", () => {
          unsubscribeProfile()
        })
      }}
    >
      <centerbox>
        <box $type="start" />
        <box $type="center">
          <image
            icon_name={iconName.as(n => n)}
            css="-gtk-icon-style: regular;"
          />
          <label label={percentage.as(p => `${Math.round(p * 100)}%`)} />
        </box>
        <box $type="end" />
      </centerbox>
    </menubutton>
  )
}
