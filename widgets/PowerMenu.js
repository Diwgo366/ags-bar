import { Gdk, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"

const actions = [
  ["Lock", "system-lock-screen-symbolic", "loginctl lock-session"],
  ["Sleep", "weather-clear-night-symbolic", "systemctl suspend"],
  ["Hibernate", "weather-severe-alert-symbolic", "systemctl hibernate"],
  ["Reboot", "view-refresh-symbolic", "systemctl reboot"],
  ["Shutdown", "system-shutdown-symbolic", "systemctl poweroff"],
]

export default () => (
  <box class="powermenu bar-button">
    <button
      $={self => {
        const popover = new Gtk.Popover()
        popover.set_parent(self)
        popover.add_css_class("popover")

        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })

        for (const [label, icon, cmd] of actions) {
          const btn = new Gtk.Button({ css_classes: ["popover-button"] })

          const hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
          const img = new Gtk.Image({ icon_name: icon, pixel_size: 16 })
          const lbl = new Gtk.Label({ label, xalign: 0 })

          hbox.append(img)
          hbox.append(lbl)
          btn.set_child(hbox)

          btn.connect("clicked", () => {
            popover.popdown()
            execAsync(cmd)
          })
          box.append(btn)
        }

        popover.set_child(box)

        self.connect("clicked", () => popover.popup())
        self.connect("destroy", () => popover.unparent())
      }}
    >
      <image icon_name="system-shutdown-symbolic" />
    </button>
  </box>
)
