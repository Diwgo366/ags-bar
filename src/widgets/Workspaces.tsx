import Hyprland from "gi://AstalHyprland"
import { createBinding, createComputed, createConnection } from "ags"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import { getIconName } from "../services/icons/iconResolver.js"
import { runWorkspaceScript } from "../services/workspaceScripts.js"

const hyprland = Hyprland.get_default()

interface WorkspaceSlotProps {
  id: number
  workspaces: any
}

function WorkspaceSlot({ id, workspaces }: WorkspaceSlotProps) {
  const state = workspaces.as((slots: any[]) => slots[id - 1])

  return (
    <centerbox
      class={state.as((s) => s.boxClass)}
      $={(self) => {
        const click = Gtk.GestureClick.new()
        click.connect("pressed", () => {
          void execAsync([
            "hyprctl",
            "dispatch",
            `hl.dsp.focus({ workspace = ${id} })`,
          ]).catch((error) =>
            console.error(`No se pudo cambiar al workspace ${id}:`, error),
          )
        })
        self.add_controller(click)
      }}
    >
      <box $type="start" />
      <box $type="center">
        <image
          pixel-size={22}
          icon_name={state.as((s) => s.iconName ?? "")}
          visible={state.as((s) => s.iconName !== null)}
        />
        <label
          label={String(id)}
          visible={state.as((s) => s.iconName === null)}
        />
      </box>
      <box $type="end" />
    </centerbox>
  )
}

export default function Workspaces() {
  const ids = Array.from({ length: 10 }, (_, i) => i + 1)
  const clients = createBinding(hyprland, "clients")
  const focusedWs = createBinding(hyprland, "focused-workspace")
  const moved = createConnection(0, [hyprland, "client-moved", Date.now])

  const workspaces = createComputed(() => {
    moved()
    const masters = new Map<number, any>()

    for (const client of clients()) {
      const id = client.get_workspace()?.get_id()
      if (!id) continue

      const current = masters.get(id)
      if (!current || client.get_x() < current.get_x()) {
        masters.set(id, client)
      }
    }

    const focusedId = focusedWs()?.get_id()
    return ids.map((id) => {
      const master = masters.get(id)
      return {
        iconName: master ? getIconName(master.get_class()) : null,
        boxClass:
          focusedId === id
            ? "workspace focused bar-button"
            : "workspace bar-button",
      }
    })
  })

  let lastFocusedId = focusedWs()?.get_id()
  let hasInitialWorkspace = lastFocusedId !== undefined

  return (
    <box
      $={(self) => {
        const unsubscribe = focusedWs.subscribe(() => {
          const focusedId = focusedWs()?.get_id()
          if (focusedId === undefined) return
          if (!hasInitialWorkspace) {
            lastFocusedId = focusedId
            hasInitialWorkspace = true
            return
          }
          if (focusedId === lastFocusedId) return
          lastFocusedId = focusedId
          void runWorkspaceScript(focusedId)
        })
        self.connect("destroy", unsubscribe)
      }}
    >
      {ids.map((id) => (
        <WorkspaceSlot id={id} workspaces={workspaces} />
      ))}
    </box>
  )
}
