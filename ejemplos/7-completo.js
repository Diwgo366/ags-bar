// ============================================================
// EJEMPLO 7: Barra completa (todo junto)
// ============================================================
// Combina: workspaces, reloj, batería, clientes, eventos
// ============================================================

import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"
import Hyprland from "gi://AstalHyprland"
import { createPoll } from "ags/time"

// Servicios globales
const hyprland = Hyprland.get_default()

// Battery es opcional — si no está instalado, no rompe
let battery = null
try {
  const { default: Bat } = await import("gi://AstalBattery")
  battery = Bat.get_default()
} catch (_) {
  console.warn("AstalBattery no instalado, omitiendo indicador de batería")
}

// ============================================================
// COMPONENTES
// ============================================================

function Workspaces() {
  const workspaces = hyprland.get_workspaces()
  const focused = hyprland.get_focused_workspace()

  return workspaces.map((ws) => (
    <button
      class={ws.get_id() === focused.get_id() ? "focused" : ""}
      onClicked={() => hyprland.dispatch("workspace", String(ws.get_id()))}
    >
      <label label={String(ws.get_id())} />
    </button>
  ))
}

function ClientTitle() {
  const cliente = hyprland.get_focused_client()
  if (!cliente) return <box />

  return <label label={cliente.get_title()} />
}

function Reloj() {
  const hora = createPoll("", 1000, () =>
    new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  )
  return <label class="clock" label={hora} />
}

function IndicadorBateria() {
  // is_present: si hay batería
  if (!battery?.get_is_present()) return <box />

  const porcentaje = battery.get_percentage()
  const cargando = battery.get_charging()
  const icono = cargando ? "⚡" : porcentaje > 0.2 ? "🔋" : "🪫"

  return (
    <label
      class="battery"
      label={`${icono} ${Math.round(porcentaje * 100)}%`}
    />
  )
}

// ============================================================
// INPUT HANDLER
// ============================================================
// Para detectar teclas en la ventana (ej: super + r para launcher)
// ============================================================
function setupKeybinds(window) {
  // controller.connect("key-pressed", (controller, keyval, keycode, state) => { ... })
  // Esto se verá más adelante. Por ahora placeholder.
}

// ============================================================
// MAIN
// ============================================================

app.start({
  main() {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    return (
      <window
        visible
        anchor={TOP | LEFT | RIGHT}
        exclusivity={Astal.Exclusivity.EXCLUSIVE}
      >
        <centerbox>
          {/* IZQUIERDA: workspaces */}
          <box $type="start" spacing={4}>
            <Workspaces />
          </box>

          {/* CENTRO: cliente activo */}
          <box $type="center">
            <ClientTitle />
          </box>

          {/* DERECHA: batería + reloj */}
          <box $type="end" spacing={8}>
            <IndicadorBateria />
            <Reloj />
          </box>
        </centerbox>
      </window>
    )
  },
})

// ============================================================
// PRÓXIMOS PASOS
// ============================================================
// Acá tenés ideas para seguir:
//
// 1. Agregar volumen:
//    import Audio from "gi://AstalWirePlumber"
//    const audio = Audio.get_default()
//    audio.get_default_speaker().get_volume()
//
// 2. Agregar redes:
//    import Network from "gi://AstalNetwork"
//    const net = Network.get_default()
//    net.get_wifi()?.get_ssid()
//
// 3. Agregar notificaciones:
//    import Notifd from "gi://AstalNotifd"
//    const notifd = Notifd.get_default()
//    notifd.connect("notified", (self, id) => { ... })
//
// 4. Agregar bandeja de sistema:
//    import Tray from "gi://AstalTray"
//    const tray = Tray.get_default()
//    tray.get_items().map(item => <button>{item}</button>)
//
// 5. CSS: editá style.css para cambiar colores, fondos, etc.
// ============================================================
