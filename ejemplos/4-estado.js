// ============================================================
// EJEMPLO 4: Estado reactivo (createState, createComputed)
// ============================================================
// Conceptos: estado local, valores derivados, reactividad
// ============================================================
// AGS usa señales GObject para reactividad.
// createState crea un valor reactivo (como useState de React).
// createComputed deriva un valor de otro/s estado/s.
// ============================================================

import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createState, createComputed } from "ags"

app.start({
  main() {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    // ------------------------------------------------
    // createState( valor_inicial )
    // Devuelve [ getter, setter ]
    //   getter() → lee el valor actual
    //   setter(nuevoValor) → actualiza
    // ------------------------------------------------
    const [contador, setContador] = createState(0)
    const [texto, setTexto] = createState("escribe algo...")

    // ------------------------------------------------
    // createComputed( () => expresión )
    // Deriva un valor reactivo de otro/s estado/s.
    // Se actualiza automáticamente cuando cambian
    // sus dependencias.
    // ------------------------------------------------
    const doble = createComputed(() => {
      // Al llamar a contador() como función, le decimos
      // a createComputed que depende de contador.
      return contador() * 2
    })

    // Atajo: contador((c) => c * 2)  equivale a createComputed
    const dobleAtajo = contador((c) => c * 2)

    return (
      <window
        visible
        anchor={TOP | LEFT | RIGHT}
        keymode={Astal.Keymode.ON_DEMAND}
        >
        <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>

          {/* ---------------------------------------- */}
          {/* Mostrar estado: se llama al getter () */}
          {/* ---------------------------------------- */}
          <label label={contador((c) => `Contador: ${c}`)} />
          <label label={doble((d) => `El doble es: ${d}`)} />

          {/* ---------------------------------------- */}
          {/* Botón que incrementa */}
          {/* ---------------------------------------- */}
          <box spacing={4}>
            <button onClicked={() => setContador((c) => c + 1)}>
              <label label="+1" />
            </button>
            <button onClicked={() => setContador(0)}>
              <label label="Reset" />
            </button>
          </box>

          {/* ---------------------------------------- */}
          {/* Estado con texto */}
          {/* ---------------------------------------- */}
          <entry
            placeholder_text="Escribe algo..."
            onChanged={(self) => setTexto(self.text)}
          />
          <label label={texto((t) => `Escribiste: ${t}`)} />

        </box>
      </window>
    )
  },
})

// -------------------- PARA ENTENDER --------------------
//
// ¿Qué es reactividad?
//   Es la capacidad de que un widget se actualice SOLO
//   cuando cambia el dato del que depende.
//   No necesitás refrescar nada manualmente.
//
// createState:
//   Crea un valor reactivo.
//   Uso: const [valor, setValor] = createState(0)
//   valor() → lee (importante: se llama como función)
//   setValor(3) → escribe
//   setValor((v) => v + 1) → escribe con función
//
// En JSX se usa así:
//   <label label={contador((c) => `Valor: ${c}`)} />
//   El (c) => ... es una función de transformación opcional.
//
// createComputed:
//   Crea un valor DERIVADO de otros estados.
//   Se actualiza automáticamente cuando sus dependencias cambian.
//   Dentro de la función, llamá a los estados como funciones
//   para que se registren como dependencias.
//
// Atajo de transformación:
//   contador((c) => c * 2)
//   Es equivalente a:
//   createComputed(() => contador() * 2)
//
// ¿Por qué se llaman como función?
//   Porque en GJS/JavaScript no podemos interceptar la
//   lectura de propiedades (proxies tienen limitaciones).
//   Así que usamos función → getter() para leer.
// -------------------------------------------------------
