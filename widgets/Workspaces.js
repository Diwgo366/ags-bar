import Hyprland from "gi://AstalHyprland"
import { createBinding, createComputed, createConnection } from "ags"
import { execAsync } from "ags/process"
import { Gdk, Gtk } from "ags/gtk4"

const hyprland = Hyprland.get_default()

function getIconName(clientClass) {
  if (!clientClass) return null
  const display = Gdk.Display.get_default()
  const iconTheme = Gtk.IconTheme.get_for_display(display)
  const lower = clientClass.toLowerCase()
  if (iconTheme.has_icon(lower)) return lower
  if (iconTheme.has_icon(`application-${lower}`)) return `application-${lower}`
  return "application-x-executable"
}

function WorkspaceSlot({ id }) {
  const allClients = createBinding(hyprland, "clients")
  const focusedWs = createBinding(hyprland, "focused-workspace")
  const moved = createConnection(0, [hyprland, "client-moved", () => Date.now()])

  const state = createComputed(() => {
    const clients = allClients().filter(c => c.get_workspace()?.get_id() === id)
    moved()
    const fw = focusedWs()
    // Volvemos a ordenar de izquierda a derecha (la que tenga menor get_x() será master)
    const master = [...clients].sort((a, b) => a.get_x() - b.get_x())[0]
    return {
      iconName: master ? getIconName(master.get_class()) : null,
      boxClass: fw?.get_id() === id ? "workspace focused bar-button" : "workspace bar-button",
    }
  })

  return (
    <centerbox
      class={state.as(s => s.boxClass)}
      $={self => {
        const click = Gtk.GestureClick.new()
        click.connect("pressed", () => {
          if (id === 10)
            execAsync("bash -c '~/.config/hypr/scripts/workspace10.sh'")
          else
            hyprland.dispatch("workspace", String(id))
        })
        self.add_controller(click)
      }}
    >
      <box $type="start" />
      <box $type="center">
        <image
          icon_name={state.as(s => s.iconName ?? "")}
          visible={state.as(s => s.iconName !== null)}
        />
        <label
          label={String(id)}
          visible={state.as(s => s.iconName === null)}
        />
      </box>
      <box $type="end" />
    </centerbox>
  )
}

export default function Workspaces() {
  const ids = Array.from({ length: 10 }, (_, i) => i + 1)

  return (
    <box class="workspaces">
      {ids.map(id => <WorkspaceSlot id={id} />)}
    </box>
  )
}
