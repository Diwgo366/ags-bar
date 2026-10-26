import GLib from "gi://GLib"

export const AGS_DIR = (() => {
  const dir = GLib.getenv("AGS_DIR")
  if (!dir) {
    throw new Error("AGS_DIR no está configurada antes de iniciar AGS")
  }
  return dir
})()

// Ejecuta las integraciones de tema al iniciar AGS y al seleccionar un tema.
export let RUN_THEME_SCRIPTS = true
export let RUN_WORKSPACES_SCRIPTS = true

// Script filenames are resolved inside src/services/workspace_scripts/.
// Arguments use shell-style quoting and are passed as separate argv values.
export let ws1_script = ""
export let ws1_args = ""
export let ws2_script = ""
export let ws2_args = ""
export let ws3_script = ""
export let ws3_args = ""
export let ws4_script = ""
export let ws4_args = ""
export let ws5_script = ""
export let ws5_args = ""
export let ws6_script = ""
export let ws6_args = ""
export let ws7_script = ""
export let ws7_args = ""
export let ws8_script = ""
export let ws8_args = ""
export let ws9_script = ""
export let ws9_args = ""
export let ws10_script = "10.sh"
export let ws10_args = ""

export let LOCALE = "es-PE"
export let TIME_FORMAT = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
}
export let DATE_FORMAT = {
  weekday: "short",
  day: "numeric",
  month: "long",
}

// Configuración de los intervalos de actualización (en milisegundos)
// 1000 ms = 1 segundo.
// Aumentar estos valores reduce el consumo de CPU y batería,
// pero hace que la información en la barra tarde más en actualizarse.
export let INTERVAL = {
  // Reloj principal (actualiza cada segundo para mostrar los segundos correctamente)
  CLOCK: 1000,

  // Fecha (actualiza cada minuto ya que no cambia frecuentemente)
  DATE: 60000,

  // Uso de RAM (cada 5 segundos es un buen balance)
  MEMORY: 5000,

  // Uso de CPU (cada 3 segundos permite ver picos de actividad sin saturar el sistema)
  CPU: 3000,

  // Temperatura (cada 5 segundos, los cambios térmicos son graduales)
  TEMPERATURE: 5000,

  // Estado de red Wifi/Ethernet (cada 5 segundos)
  NETWORK: 5000,

  // Perfil de energía TLP (cada 2 segundos para detectar cuando conectas/desconectas el cargador rápido)
  BATTERY_PROFILE: 2000,

  // Calendario Google Calendar via iCal (cada 5 minutos)
  CALENDAR: 300000,
}

// Overlay / OSD configuration
export let OVERLAY = {
  FADE_DURATION: 150,
  HIDE_DELAY: 750,
  LED_POLL_INTERVAL: 200,
}

// Configuración del calendario semanal (popup)
export let CALENDAR = {
  START_HOUR: 8,
  END_HOUR: 22,
  SHOW_HOUR: true,
  SHOW_EXTRA: true,
  HOUR_HEIGHT: 20,
  NUM_DAYS: 7,
}

export function applyAppConfig(updated) {
  if (updated.RUN_THEME_SCRIPTS !== undefined) RUN_THEME_SCRIPTS = updated.RUN_THEME_SCRIPTS
  if (updated.RUN_WORKSPACES_SCRIPTS !== undefined) RUN_WORKSPACES_SCRIPTS = updated.RUN_WORKSPACES_SCRIPTS
  if (updated.ws1_script !== undefined) ws1_script = updated.ws1_script
  if (updated.ws1_args !== undefined) ws1_args = updated.ws1_args
  if (updated.ws2_script !== undefined) ws2_script = updated.ws2_script
  if (updated.ws2_args !== undefined) ws2_args = updated.ws2_args
  if (updated.ws3_script !== undefined) ws3_script = updated.ws3_script
  if (updated.ws3_args !== undefined) ws3_args = updated.ws3_args
  if (updated.ws4_script !== undefined) ws4_script = updated.ws4_script
  if (updated.ws4_args !== undefined) ws4_args = updated.ws4_args
  if (updated.ws5_script !== undefined) ws5_script = updated.ws5_script
  if (updated.ws5_args !== undefined) ws5_args = updated.ws5_args
  if (updated.ws6_script !== undefined) ws6_script = updated.ws6_script
  if (updated.ws6_args !== undefined) ws6_args = updated.ws6_args
  if (updated.ws7_script !== undefined) ws7_script = updated.ws7_script
  if (updated.ws7_args !== undefined) ws7_args = updated.ws7_args
  if (updated.ws8_script !== undefined) ws8_script = updated.ws8_script
  if (updated.ws8_args !== undefined) ws8_args = updated.ws8_args
  if (updated.ws9_script !== undefined) ws9_script = updated.ws9_script
  if (updated.ws9_args !== undefined) ws9_args = updated.ws9_args
  if (updated.ws10_script !== undefined) ws10_script = updated.ws10_script
  if (updated.ws10_args !== undefined) ws10_args = updated.ws10_args
  if (updated.LOCALE !== undefined) LOCALE = updated.LOCALE
  if (updated.TIME_FORMAT) TIME_FORMAT = { ...TIME_FORMAT, ...updated.TIME_FORMAT }
  if (updated.DATE_FORMAT) DATE_FORMAT = { ...DATE_FORMAT, ...updated.DATE_FORMAT }
  if (updated.INTERVAL) INTERVAL = { ...INTERVAL, ...updated.INTERVAL }
  if (updated.OVERLAY) OVERLAY = { ...OVERLAY, ...updated.OVERLAY }
  if (updated.CALENDAR) CALENDAR = { ...CALENDAR, ...updated.CALENDAR }
}

export function getWorkspaceScriptConfig(id) {
  switch (id) {
    case 1: return { script: ws1_script, args: ws1_args }
    case 2: return { script: ws2_script, args: ws2_args }
    case 3: return { script: ws3_script, args: ws3_args }
    case 4: return { script: ws4_script, args: ws4_args }
    case 5: return { script: ws5_script, args: ws5_args }
    case 6: return { script: ws6_script, args: ws6_args }
    case 7: return { script: ws7_script, args: ws7_args }
    case 8: return { script: ws8_script, args: ws8_args }
    case 9: return { script: ws9_script, args: ws9_args }
    case 10: return { script: ws10_script, args: ws10_args }
    default: return { script: "", args: "" }
  }
}
