# AGS Hyprland Bar

## Punto de entrada

La aplicación actual se inicia con `app.ts`:

```sh
ags run "$AGS_DIR/src/app.ts"
```

La ruta del proyecto se configura en
`~/.config/hypr/config/paths.lua`, en la propiedad `ags`. Hyprland la exporta
como `AGS_DIR` y los scripts de inicio y alternancia de la barra reutilizan
esa misma variable.

`src/app.ts` crea la barra, el overlay, el calendario y el selector de temas.

Los scripts activos de Hyprland que lo lanzan son
`~/.config/hypr/scripts/ui/start-ags.sh` y
`~/.config/hypr/scripts/ui/toggle-ags.sh`. El atajo `SUPER+T` solo alterna la
ventana `theme-selector`.

## Mapa del proyecto

```text
src/app.ts              Entrada activa de AGS
src/config/             Configuración general
src/services/           Integraciones externas y lógica reutilizable
src/services/theme_scripts/ Integraciones ejecutadas por AGS
src/themes/             Temas y gestión del CSS
src/widgets/            Componentes de la interfaz

src/bar/
  Bar.tsx               Ventana principal de la barra
  Left.tsx              Workspaces
  Center.tsx            Reloj y fecha
  Right.tsx             Widgets del sistema

src/themes/
  themes/*.json         Temas disponibles
  theme.json            Tema actualmente aplicado
  theme.css.js          Generación y aplicación del CSS de AGS

```

El daemon de fondos vive en `src/services/wallpaper-daemon.sh` y solo gestiona
el wallpaper. AGS ejecuta al iniciar y al seleccionar un tema, en orden
alfabético, todos los archivos regulares ejecutables directamente dentro de
`src/services/theme_scripts/`. Al seleccionar, primero copia el JSON elegido a
`src/themes/theme.json`; después corre las integraciones y actualiza su CSS.
Cada script puede sincronizar los colores u otras propiedades del tema con otra aplicación.
Para agregar una integración, coloca allí un script ejecutable (por ejemplo,
`update-hyprland-borders.sh`) que lea el tema activo desde
`$AGS_DIR/src/themes/theme.json`. Los errores de un script se registran y no
impiden que se ejecuten los siguientes. `RUN_THEME_SCRIPTS` en
`src/config/appConfig.js` permite activar o desactivar estas ejecuciones tanto
al iniciar AGS como al seleccionar un tema.

La implementación activa usa los componentes `.tsx` desde `src/app.ts`.
Para una funcionalidad nueva, edita el módulo dentro de `src/` que corresponda
a su responsabilidad.

## Flujo para cambiar un tema

1. El selector copia `themes/<nombre>.json` a `themes/theme.json`.
2. Ejecuta los scripts de integración en `src/services/theme_scripts/`.
3. `theme.css.js` aplica el CSS de AGS a partir de `theme.json`.

La configuración privada del calendario se guarda en
`src/config/privateConfig.js`, excluido del repositorio. AGS lo genera al
iniciar si no existe. Edita la propiedad `calendarUrl` en ese archivo:

```js
export const privateConfig = {
  calendarUrl: "https://calendar.google.com/calendar/ical/.../basic.ics",
}
```

Si la URL está vacía, el calendario simplemente no carga eventos.

## Limpieza pendiente

La ruta externa ya está verificada y usa `src/app.ts`.

## Dependencias del sistema

- AGS con soporte GTK4 y GJS
- Hyprland y `hyprctl`
- Astal Battery
- Python 3 para el generador de temas
- TLP, si se usa el selector de perfil de batería
