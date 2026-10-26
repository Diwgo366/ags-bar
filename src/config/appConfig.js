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
  if (updated.LOCALE !== undefined) LOCALE = updated.LOCALE
  if (updated.TIME_FORMAT) TIME_FORMAT = { ...TIME_FORMAT, ...updated.TIME_FORMAT }
  if (updated.DATE_FORMAT) DATE_FORMAT = { ...DATE_FORMAT, ...updated.DATE_FORMAT }
  if (updated.INTERVAL) INTERVAL = { ...INTERVAL, ...updated.INTERVAL }
  if (updated.OVERLAY) OVERLAY = { ...OVERLAY, ...updated.OVERLAY }
  if (updated.CALENDAR) CALENDAR = { ...CALENDAR, ...updated.CALENDAR }
}
