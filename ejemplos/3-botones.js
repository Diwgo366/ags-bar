// ============================================================
// EJEMPLO 3: Botones y eventos
// ============================================================
// Conceptos: onClicked, clases CSS dinámicas, interactividad
// ============================================================

import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"

app.start({
  main() {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    // CSS para que la clase "activo" tenga efecto visual
    const provider = new Gtk.CssProvider()
    provider.load_from_string(`
      .activo {
        background-color: #3584e4;
        color: white;
        border-radius: 12px;
      }
    `)
    const display = Gdk.Display.get_default()
    Gtk.StyleContext.add_provider_for_display(
      display,
      provider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    )

    // Las funciones pueden definirse antes del JSX
    function handleClick(boton) {
      // "boton" es el widget Gtk.Button que recibió el click
      print(`Click! texto actual: ${boton.child.label}`)

      // Podemos modificar propiedades del botón directamente
      boton.child.label = "✅ Clicked!"
    }

    return (
      <window visible anchor={TOP | LEFT | RIGHT}>
        <box spacing={8}>

          {/* ---------------------------------------- */}
          {/* Botón simple con onClicked */}
          {/* ---------------------------------------- */}
          {/* onClicked recibe una función.
              La función recibe el botón como parámetro. */}
          <button onClicked={(self) => print("click!")}>
            <label label="Click me" />
          </button>

          {/* ---------------------------------------- */}
          {/* Botón que llama a una función externa */}
          {/* ---------------------------------------- */}
          <button onClicked={handleClick}>
            <label label="Otro botón" />
          </button>

          {/* ---------------------------------------- */}
          {/* Botón que alterna clase CSS */}
          {/* ---------------------------------------- */}
          {/* Podemos cambiar clases dinámicamente.
              add_css_class / remove_css_class son métodos de GTK. */}
          <button
            onClicked={(self) => {
              if (self.has_css_class("activo")) {
                self.remove_css_class("activo")
              } else {
                self.add_css_class("activo")
              }
            }}
          >
            <label label="Toggle" />
          </button>

          {/* ---------------------------------------- */}
          {/* Botón que abre una URL */}
          {/* ---------------------------------------- */}
          <button onClicked={() => {
            const GLib = imports.gi.GLib
            GLib.spawn_command_line_async("xdg-open https://google.com")
          }}>
            <label label="🌐 Google" />
          </button>

          {/* ---------------------------------------- */}
          {/* Todos los botones clickeables:
              Podés ejecutar hyprctl, abrir apps, lo que sea
              con spawn_command_line_async */}
          {/* ---------------------------------------- */}
          <button onClicked={() => {
            const GLib = imports.gi.GLib
            GLib.spawn_command_line_async("hyprctl dispatch exec kitty")
          }}>
            <label label="▶ Terminal" />
          </button>

        </box>
      </window>
    )
  },
})

// -------------------- PARA ENTENDER --------------------
//
// Eventos comunes en botones:
//   onClicked: cuando se hace click
//   onPressed: cuando se presiona (antes de soltar)
//   onReleased: cuando se suelta
//
// Eventos en otros widgets:
//   label → no tiene eventos (solo texto)
//   box → no tiene eventos de click directo
//   window → onKeyPressEvent, onButtonPressEvent
//
// Para más control, se pueden usar EventControllers:
//   <Gtk.GestureClick
//     propagationPhase={Gtk.PropagationPhase.CAPTURE}
//     button={3}  // 1=izquierdo, 2=medio, 3=derecho
//     onPressed={(self, n_press, x, y) => print("click derecho")}
//   />
//
// spawn_command_line_async("comando")
//   Ejecuta un comando en el sistema. Útil para lanzar apps,
//   ejecutar hyprctl, scripts, etc.
//   Vive en: imports.gi.GLib
// -------------------------------------------------------
