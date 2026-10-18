import { createBinding, createComputed, createState } from "ags"
import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import Bat from "gi://AstalBattery"
import { INTERVAL } from "../config/appConfig.js"

const battery = Bat.get_default()

function batteryIcon(pct: number, charging: boolean, profile: string) {
  const level = Math.max(0, Math.min(100, Math.round(pct * 100)))
  const rounded = Math.floor(level / 10) * 10
  const padded = String(rounded).padStart(3, "0")
  const state = charging ? "-charging" : ""

  if (profile === "none") return `battery-${padded}${state}`

  return `battery-${padded}${state}-profile-${profile}`
}

const PROFILES = [
  [
    "Ahorro",
    "powersave",
    "sudo tlp power-saver",
    "power-profile-power-saver-symbolic",
  ],
  [
    "Balanceado",
    "balanced",
    "sudo tlp balanced",
    "power-profile-balanced-symbolic",
  ],
  [
    "Rendimiento",
    "performance",
    "sudo tlp performance",
    "power-profile-performance-symbolic",
  ],
]

function createProfilePopover(
  parent: Gtk.Widget,
  profile: any,
  setProfile: (p: string) => Promise<void>,
) {
  const popover = new Gtk.Popover()
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  const rows = new Map()

  function updateActiveProfile(current = profile()) {
    for (const [id, { btn, indicator }] of rows) {
      const active = id === current
      btn.set_active(active)
      indicator.set_opacity(active ? 1 : 0)
    }
  }

  for (const [label, id, cmd, iconName] of PROFILES) {
    const btn = new Gtk.ToggleButton()
    const hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
    const profileIcon = new Gtk.Image({
      icon_name: iconName,
      pixel_size: 18,
    })
    const indicator = new Gtk.Image({
      icon_name: "object-select-symbolic",
      pixel_size: 16,
    })
    const lbl = new Gtk.Label({ label, xalign: 0 })

    hbox.append(profileIcon)
    hbox.append(lbl)
    hbox.append(indicator)
    btn.set_child(hbox)
    btn.connect("clicked", async () => {
      try {
        await execAsync(["bash", "-c", cmd])
        await setProfile(id)
        popover.popdown()
      } catch (error) {
        console.error(`Error cambiando al perfil ${id}:`, error)
      }
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

  async function getRealProfile() {
    try {
      const out = await execAsync([
        "bash",
        "-c",
        "tlp-stat -s 2>/dev/null | awk -F'= ' '/TLP profile/ {print tolower($2); exit}'",
      ])

      const value = out.trim()
      if (value.includes("saver") || value.includes("bat")) return "powersave"
      if (value.includes("balanced")) return "balanced"
      if (value.includes("performance") || value.includes("ac")) {
        return "performance"
      }
    } catch (error) {
      console.error("Error leyendo el perfil TLP:", error)
    }

    return "balanced"
  }

  const tlpProfile = createPoll(
    "balanced",
    INTERVAL.BATTERY_PROFILE,
    getRealProfile,
  )
  const [selectedProfile, setSelectedProfile] = createState(tlpProfile())
  const unsubscribeProfile = tlpProfile.subscribe(() => {
    setSelectedProfile(tlpProfile())
  })

  const iconName = createComputed(() =>
    batteryIcon(percentage(), charging(), selectedProfile()),
  )

  return (
    <menubutton
      class="bar-item right-item"
      $={(self) => {
        const menuButton = self as Gtk.MenuButton
        const popover = createProfilePopover(
          menuButton,
          selectedProfile,
          async (profile) => setSelectedProfile(profile),
        )
        menuButton.set_popover(popover)
        menuButton.connect("destroy", () => {
          unsubscribeProfile()
        })
      }}
    >
      <centerbox>
        <box $type="start" />
        <box $type="center">
          <image
            icon_name={iconName.as((n) => n)}
            css="-gtk-icon-style: regular;"
          />
          <label label={percentage.as((p) => `${Math.round(p * 100)}%`)} />
        </box>
        <box $type="end" />
      </centerbox>
    </menubutton>
  )
}
