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
src/services/theme_scripts/ Scripts ejecutados al aplicar un tema
src/themes/             Temas y gestión del CSS
src/widgets/            Componentes de la interfaz

src/bar/
  Bar.tsx               Ventana principal de la barra
  Left.tsx              Workspaces
  Center.tsx            Reloj y fecha
  Right.tsx             Widgets del sistema

src/themes/
  themes/*.json         Temas disponibles
  current-theme.json    Tema seleccionado
  base.js               Tema AGS generado
  generate-ags-theme.py Generador de base.js
  themeLoader.js        Carga el tema AGS generado

```

El daemon de fondos vive en `src/services/wallpaper-daemon.sh`. Los scripts
ejecutables que se añadan a `src/services/theme_scripts/` se ejecutan cuando
se aplica un tema. `RUN_THEME_SCRIPTS` en `src/config/appConfig.js` permite
activar o desactivar este comportamiento.

La implementación activa usa los componentes `.tsx` desde `src/app.ts`.
Para una funcionalidad nueva, edita el módulo dentro de `src/` que corresponda
a su responsabilidad.

## Flujo para cambiar un tema

1. El selector escribe `themes/current-theme.json`.
2. `themes/generate-ags-theme.py` genera `themes/base.js`.
3. `themeManager.js` vuelve a generar y aplica el CSS de AGS.

La configuración privada se guarda fuera del repositorio, en
`~/.config/ags/private-config.json`. El archivo se genera automáticamente al
iniciar la aplicación si no existe. Edítalo y coloca la URL privada de Google
Calendar en la propiedad `calendarUrl`:

```json
{
  "calendarUrl": "https://calendar.google.com/calendar/ical/.../basic.ics"
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
