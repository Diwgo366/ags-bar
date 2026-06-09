// ============================================================
// EJEMPLO 1: Ventana básica
// ============================================================
// Conceptos: importar app, crear ventana, anchors, ejecutar
// ============================================================
// Para probar:
//   ags run ~/.config/ags/ejemplos/1-ventana.js
// Para cerrar:
//   ags quit
// ============================================================

// Toda app de AGS necesita:
// 1. El módulo "app" para iniciar la aplicación GTK
import app from "ags/gtk4/app"
// 2. Astal tiene constantes útiles como WindowAnchor
import { Astal } from "ags/gtk4"

app.start({
  // main() es la función que se ejecuta al arrancar.
  // Acá creamos todas nuestras ventanas y widgets.
  main() {
    // Astal.WindowAnchor define dónde se "pega" la ventana.
    // Se combinan con el operador | (OR binario).
    const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor

    // La etiqueta <window> es la raíz de todo widget en AGS.
    // Propiedades importantes:
    // - visible: obligatorio en GTK4 (las ventanas nacen ocultas)
    // - anchor: dónde se posiciona (TOP | LEFT | RIGHT = barra superior)
    // - monitor: si tenés varios monitores, elegís cuál (0 = primero)
    // - exclusivity: si otros programas pueden cubrirla
    return (
      <window
        visible        /* Obligatorio: muestra la ventana */
        anchor={TOP}   /* Solamente arriba (sin estirar a los costados) */
        monitor={0}    /* Primer monitor */
        exclusivity={true} /* Nadie puede cubrir esta ventana (si es barra) */
      >
        {/* El contenido hijo va acá */}
        <box spacing={30} homogeneous={true}>
          <label label="Hola AGS!" />
          <label label="Segundo Mensaje" />
          <label label="Tercer Mensaje" />
        </box>
      </window>
    )
  },
})

// -------------------- PARA ENTENDER --------------------
//
// <window> es el componente raíz. Todo widget vive dentro de una ventana.
// Podés tener múltiples ventanas (ej: barra arriba, notificaciones, launcher).
//
// anchors disponibles (se combinan con |):
//   TOP    = arriba
//   BOTTOM = abajo
//   LEFT   = izquierda
//   RIGHT  = derecha
//
// Ejemplos comunes:
//   TOP | LEFT | RIGHT   → barra superior completa
//   TOP | RIGHT           → solo esquina superior derecha
//   BOTTOM | LEFT | RIGHT → barra inferior
//
// <box> es el contenedor básico (como un div flex).
//   spacing = espacio entre hijos (en píxeles)
//   homogeneous = todos los hijos con el mismo tamaño
//   vertical = true (por defecto es horizontal)
//
// <label> muestra texto.
//   label = el texto a mostrar
// -------------------------------------------------------
