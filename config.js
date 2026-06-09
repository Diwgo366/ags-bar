export const LOCALE = "es-PE"
export const TIME_FORMAT = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: 'h23',
}
export const DATE_FORMAT = {
  weekday: "short",
  day: "numeric",
  month: "long",
}

// Configuración de los intervalos de actualización (en milisegundos)
// 1000 ms = 1 segundo.
// Aumentar estos valores reduce el consumo de CPU y batería,
// pero hace que la información en la barra tarde más en actualizarse.
export const INTERVAL = {
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
  
  // Perfil de energía TLP (cada 3 segundos para detectar cuando conectas/desconectas el cargador rápido)
  BATTERY_PROFILE: 3000,

  // Tareas pendientes de Brave Tasks (cada 10 segundos)
  TASKS: 10000,
}
