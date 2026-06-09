// ============================================================
// EJEMPLO 5: Reloj en vivo (createPoll)
// ============================================================
// Conceptos: polling, subprocess, formateo de fechas
// ============================================================

import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"

app.start({
  main() {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    // CSS para los estilos
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

    // ------------------------------------------------
    // createPoll(seed, intervalMs, source)
    // ------------------------------------------------
    // seed: valor inicial (no importa, se reemplaza)
    // intervalMs: cada cuánto se actualiza (ms)
    // source: string (comando) o función
    //
    // Si es string: ejecuta el comando y usa su stdout
    // Si es función: usa el valor de retorno
    // ------------------------------------------------

    // Opción 1: con comando (más pesado, cada 1s executa date)
    const relojCmd = createPoll("", 1000, "date '+%H:%M:%S'")

    // Opción 2: con función JS (más liviano, no executa nada)
    const relojFn = createPoll("", 1000, () => {
      const ahora = new Date()
      return ahora.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    })

    // Opción 3: con función multilínea
    const relojCompleto = createPoll("", 1000, () => {
      const ahora = new Date()
      return ahora.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })
      const fecha = ahora.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      return `${fecha}  ${hora}`
    })

    // ------------------------------------------------
    // También existe createSubprocess para monitorear
    // un proceso continuo (no polling, sino eventos)
    // ------------------------------------------------
    // createSubprocess(seed, comando)
    // Escucha el stdout del proceso permanentemente.
    // Ej: createSubprocess("", "hyprctl workspaces -j")
    // ================================================

    return (
      <window visible anchor={TOP | LEFT | RIGHT}>
        <box spacing={16}>

          {/* Reloj simple (función JS) */}
          <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
            <label label="⏱ Función JS" />
            <label class="clock" label={relojFn} />
          </box>

          {/* Separador */}
          <box class="separator" />

          {/* Reloj completo con fecha */}
          <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
            <label label="📅 Completo" />
            <label class="clock" label={relojCompleto} />
          </box>

        </box>
      </window>
    )
  },
})

// -------------------- PARA ENTENDER --------------------
//
// createPoll vs createSubprocess:
//
// createPoll(seed, ms, fuente)
//   - Ejecuta algo CADA N milisegundos
//   - fuente puede ser:
//     * String: "date +%H:%M" → ejecuta el comando
//     * Función: () => "texto" → llama la función
//   - Ideal para: reloj, clima, uso de CPU/RAM
//   - Preferí funciones JS sobre comandos (más eficiente)
//
// createSubprocess(seed, comando)
//   - Ejecuta un proceso y escucha su stdout continuamente
//   - No es polling, recibe eventos cuando hay output
//   - Ideal para: hyprctl, sensors, procesos largos
//
// createPoll("", 1000, "comando")
//   El primer argumento (seed) es el valor inicial.
//   Como se reemplaza al toque, se usa "" o null.
//
// Fechas en JavaScript:
//   new Date() → fecha actual
//   .toLocaleTimeString(locale, options)
//   .toLocaleDateString(locale, options)
//   Locale "es-AR", "es-ES", "en-US", etc.
//
// Consejo: NO uses comandos externos para el reloj.
//   JavaScript Date() es más rápido y no gasta fork().
// -------------------------------------------------------
