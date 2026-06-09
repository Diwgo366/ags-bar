// ============================================================
// EJEMPLO 6: Hyprland (workspaces, clientes, eventos)
// ============================================================
// Conceptos: AstalHyprland, workspaces, dispatch, eventos
// ============================================================
// Requisito: tener instalado libastal-hyprland
// ============================================================

import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import Hyprland from "gi://AstalHyprland"

// El servicio de Hyprland es singleton (una sola instancia).
// get_default() devuelve la instancia global.
const hyprland = Hyprland.get_default()

// ============================================================
// COMPONENTE: Workspaces
// ============================================================
// Muestra los workspaces del monitor activo.
// - Resalta el workspace activo con clase CSS "focused"
// - Al clickear cambia al workspace seleccionado
// ============================================================
function Workspaces() {
  // get_workspaces() devuelve un array reactivo.
  // Se actualiza solo cuando cambian los workspaces.
  const workspaces = hyprland.get_workspaces()
  const focused = hyprland.get_focused_workspace()

  return workspaces.map((ws) => (
    <button
      // Clase condicional: "focused" si es el activo
      class={
        ws.get_id() === focused.get_id() ? "focused" : ""
      }
      // dispatch() envía comandos a Hyprland via socket IPC
      onClicked={() =>
        hyprland.dispatch("workspace", String(ws.get_id()))
      }
    >
      <label label={String(ws.get_id())} />
    </button>
  ))
}

// ============================================================
// COMPONENTE: Cliente activo
// ============================================================
// Muestra el título de la ventana activa (focusada)
// ============================================================
function ClienteActivo() {
  // get_focused_client() puede ser null si no hay ventana activa
  const cliente = hyprland.get_focused_client()

  // Si no hay cliente activo, no mostramos nada
  if (!cliente) return null

  return (
    <label
      label={cliente.get_class()}  // ej: "kitty", "firefox"
      visible={cliente !== null}
    />
  )
}

// ============================================================
// COMPONENTE: Client Title (título completo)
// ============================================================
function ClientTitle() {
  const cliente = hyprland.get_focused_client()
  if (!cliente) return null

  return (
    <label
      label={cliente.get_title()}  // ej: "~/dev/ags — kitty"
      visible={cliente !== null}
    />
  )
}

app.start({
  main() {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    // CSS para el separador
    const provider = new Gtk.CssProvider()
    provider.load_from_string(`
      .separator {
        min-width: 2px;
        background-color: alpha(currentColor, 0.2);
      }
    `)
    const display = Gdk.Display.get_default()
    Gtk.StyleContext.add_provider_for_display(
      display, provider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    )

    return (
      <window visible anchor={TOP | LEFT | RIGHT}>
        <box spacing={8}>

          {/* Workspaces clickeables */}
          <Workspaces />

          {/* Separador */}
          <box class="separator" />

          {/* Cliente activo */}
          <ClienteActivo />

          {/* Título de la ventana */}
          <ClientTitle />

        </box>
      </window>
    )
  },
})

// ============================================================
// API de AstalHyprland
// ============================================================
//
// get_workspaces() → array de Workspace
//   ws.get_id()     → número del workspace (1, 2, 3...)
//   ws.get_name()   → nombre (o "1", "2"...)
//   ws.get_monitor() → monitor donde está
//   ws.get_windows() → ventanas en ese workspace
//
// get_focused_workspace() → Workspace activo
//   .get_id() → el id del workspace visible ahora
//
// get_clients() → array de ventanas abiertas
// get_focused_client() → ventana activa (o null)
//   .get_title()  → título de la ventana
//   .get_class()  → clase (ej: "kitty", "firefox")
//   .get_address() → dirección única
//   .get_workspace() → workspace donde está
//
// dispatch(comando, argumento)
//   Equivalente a hyprctl dispatch <comando> <argumento>
//   Ejemplos:
//     dispatch("workspace", "3")        → ir al WS 3
//     dispatch("exec", "kitty")         → abrir app
//     dispatch("killactive", "")        → cerrar ventana
//     dispatch("togglefloating", "")    → flotar ventana
//     dispatch("fullscreen", "0")       → fullscreen
//     dispatch("movetoworkspace", "4")  → mover ventana a WS 4
//
// Eventos (se conectan con .connect() ):
//   hyprland.connect("event", (name, data) => { ... })
//   hyprland.connect("workspace-added", (ws) => { ... })
//   hyprland.connect("workspace-removed", (ws) => { ... })
//   hyprland.connect("client-added", (address) => { ... })
//   hyprland.connect("client-removed", (address) => { ... })
//
// Nota: el array de workspaces es reactivo.
//   Si agregás/sacás un workspace, el componente
//   se re-renderiza solo. No necesitás refrescar.
// ============================================================
