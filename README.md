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

Los scripts que se ejecutan al cambiar de workspace viven en
`src/services/workspace_scripts/`. `RUN_WORKSPACES_SCRIPTS` los activa o
desactiva. En `src/config/appConfig.js`, configura `ws1_script` a `ws10_script`
con el nombre de un archivo `.sh` de esa carpeta y `ws1_args` a `ws10_args`
con sus argumentos. Deja ambos valores como `""` para no ejecutar un script en
ese workspace. Los argumentos aceptan comillas para conservar espacios y se
pasan como argumentos separados. Por ejemplo:

```js
export let ws3_script = "open-project.sh"
export let ws3_args = '"Proyecto de ejemplo" --restore'
```

El script se ejecuta cuando Hyprland confirma el cambio al workspace. Los
cambios a estas opciones se recargan al guardar `appConfig.js`.

La implementación activa usa los componentes `.tsx` desde `src/app.ts`.
Para una funcionalidad nueva, edita el módulo dentro de `src/` que corresponda
a su responsabilidad.

## Flujo para cambiar un tema

1. El selector copia `themes/<nombre>.json` a `themes/theme.json`.
2. Ejecuta los scripts de integración en `src/services/theme_scripts/`.
3. `theme.css.js` aplica el CSS de AGS a partir de `theme.json`.

La configuración privada del calendario se guarda en
`src/config/privateConfig.js`, excluido del repositorio en `.gitignore`.
AGS lo genera al iniciar si no existe. Las URLs de calendario iCal son
secretos personales y nunca deben compartirse ni incluirse en el control de
versiones.

El calendario soporta múltiples fuentes mediante el arreglo `calendars`:

```js
export let privateConfig = {
  calendars: [
    { name: "Universidad", url: "https://.../basic.ics" },
    { name: "Personal", url: "https://.../basic.ics" },
  ],
}
```

Cada fuente cuenta con las siguientes propiedades:

- `name`: Nombre descriptivo de la fuente para identificar sus eventos y notificaciones.
- `url`: Dirección iCal (`http`, `https` o `webcal`).

Los colores de los eventos se asignan automáticamente siguiendo una regla determinista:
mismo calendario + mismo nombre de evento = mismo color siempre (a lo largo de todas las
semanas y tras cambios de tema). Nombres distintos dentro de un mismo calendario reciben
colores distintos de la paleta del tema activo.

Para mantener compatibilidad con versiones anteriores, si el archivo define
`calendarUrl` (cadena no vacía) en lugar de `calendars`, se cargará como una
fuente única. Si ambos están presentes, `calendars` tiene prioridad.

Cualquier cambio guardado en `privateConfig.js` se recarga automáticamente sin
necesidad de reiniciar AGS. Si no hay calendarios configurados o las URLs son
inválidas, el calendario muestra el estado correspondiente.

## Limpieza pendiente

La ruta externa ya está verificada y usa `src/app.ts`.

## Dependencias del sistema

- AGS con soporte GTK4 y GJS
- Hyprland y `hyprctl`
- Astal Battery
- Python 3 para el generador de temas
- TLP, si se usa el selector de perfil de batería
