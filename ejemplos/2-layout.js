// ============================================================
// EJEMPLO 2: Layouts (boxes, centerbox, espaciado)
// ============================================================
// Conceptos: box horizontal/vertical, centerbox, anidación
// ============================================================

import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"

app.start({
  main() {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    return (
      <window visible anchor={TOP | LEFT | RIGHT}>

        {/* ============================================= */}
        {/* centerbox: 3 secciones fijas */}
        {/* ============================================= */}
        {/* Es el layout más usado para una barra.
            Los hijos llevan $type="start", "center" o "end"
            para indicar en qué sección van. */}
        <centerbox>
          {/* SECCIÓN IZQUIERDA: logos, workspaces, menú */}
          <box $type="start" spacing={8}>
            <label label="   " />   {/* Ícono de logo */}
            <label label="Inicio" />
          </box>

          {/* SECCIÓN CENTRO: reloj, título */}
          <box $type="center" spacing={4}>
            <label label="— contenido centrado —" />
          </box>

          {/* SECCIÓN DERECHA: batería, volumen, hora */}
          <box $type="end" spacing={8}>
            <label label="notif" />
            <label label="🔊" />
            <label label="22:00" />
          </box>
        </centerbox>

        {/* ============================================= */}
        {/* box horizontal simple (como flex-direction: row) */}
        {/* ============================================= */}
        {/*
        <box spacing={12}>
          <label label="[ A ]" />
          <label label="[ B ]" />
          <label label="[ C ]" />
        </box>
        */}

        {/* ============================================= */}
        {/* box vertical (como flex-direction: column) */}
        {/* ============================================= */}
        {/* */}
        <box vertical={true} spacing={6}>
          <label label="uno" />
          <label label="dos" />
          <label label="tres" />
        </box>
        

      </window>
    )
  },
})

// -------------------- PARA ENTENDER --------------------
//
// Los layouts principales:
//
// <box>
//   Contenedor básico. Por defecto horizontal.
//   Propiedades:
//     - spacing: espacio entre hijos (px)
//     - vertical: true → apila en vertical
//     - homogeneous: true → todos los hijos mismo tamaño
//     - halign / valign: alineación (START, CENTER, END, FILL)
//
// <centerbox>
//   Divide en 3 secciones: izquierda, centro, derecha.
//   Los hijos se marcan con $type="start", "center" o "end".
//   Ideal para barras porque el centro siempre queda centrado
//   aunque los costados tengan distinto contenido.
//
// Anidación:
//   <box> puede tener otros <box> adentro. Esto permite
//   crear layouts complejos.
//
//   Ej: box horizontal → adentro tiene boxes verticales
//
// pseudo-clase .child en CSS:
//   Podés seleccionar el primer/último hijo con CSS de GTK:
//     box > button:first-child { ... }
//     box > button:last-child  { ... }
// -------------------------------------------------------
