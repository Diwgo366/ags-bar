import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed } from "ags"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { applyTheme } from "../themes/theme.css.js"
import { AGS_DIR } from "../config/appConfig.js"
import { runThemeScripts } from "../services/themeScripts.js"

const THEMES_DIR = `${AGS_DIR}/src/themes`

interface Theme {
  id: string
  name: string
  desc: string
  color: string
  wallpaper?: string
  path: string
}

function loadThemes(): Theme[] {
  const themesDir = `${THEMES_DIR}/themes`
  const themes: Theme[] = []
  try {
    const directory = Gio.File.new_for_path(themesDir)
    const enumerator = directory.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null,
    )
    let info
    while ((info = enumerator.next_file(null))) {
      const filename = info.get_name()
      if (!filename.endsWith(".json")) continue

      const filePath = `${themesDir}/${filename}`
      try {
        const [ok, content] = GLib.file_get_contents(filePath)
        if (!ok) continue
        const theme = JSON.parse(new TextDecoder().decode(content))
        themes.push({
          id: filename.replace(/\.json$/, ""),
          name: theme.name || filename.replace(/\.json$/, ""),
          desc: theme.desc || "Tema personalizado",
          color:
            theme.colors?.accent || theme.colors?.primary?.main || "#888888",
          wallpaper: theme.wallpaper || "",
          path: filePath,
        })
      } catch (error) {
        console.warn(`No se pudo cargar el tema ${filePath}:`, error)
      }
    }
    enumerator.close(null)
    themes.sort((a, b) => a.name.localeCompare(b.name))
  } catch (e) {
    console.error("Error cargando temas:", e)
  }
  return themes
}

function getWallpaperPath(wallpaperPath: string): string {
  if (!wallpaperPath) return ""
  if (wallpaperPath.startsWith("/")) return wallpaperPath
  return `${GLib.get_home_dir()}/${wallpaperPath}`
}

function createWallpaperThumbnail(wallpaperPath: string): string {
  try {
    if (!wallpaperPath || !GLib.file_test(wallpaperPath, GLib.FileTest.EXISTS)) {
      return ""
    }

    const fileInfo = Gio.File.new_for_path(wallpaperPath).query_info(
      "time::modified,standard::size",
      Gio.FileQueryInfoFlags.NONE,
      null,
    )
    const signature = [
      wallpaperPath,
      fileInfo.get_size(),
      fileInfo.get_attribute_uint64("time::modified"),
    ].join(":")
    const cacheDir = `${GLib.get_user_cache_dir()}/ags/theme-thumbnails`
    GLib.mkdir_with_parents(cacheDir, 0o755)

    const cacheKey = GLib.compute_checksum_for_string(
      GLib.ChecksumType.SHA256,
      signature,
      -1,
    )
    const thumbnailPath = `${cacheDir}/${cacheKey}-color-v2.jpg`
    if (GLib.file_test(thumbnailPath, GLib.FileTest.EXISTS)) {
      return thumbnailPath
    }

    const extension = wallpaperPath.split(".").pop()?.toLowerCase() ?? ""
    const videoExtensions = new Set(["mp4", "mkv", "webm", "mov", "avi", "m4v"])
    if (videoExtensions.has(extension)) {
      const filter = "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2"
      const [ok, , , status] = GLib.spawn_sync(
        null,
        [
          "ffmpeg",
          "-v",
          "error",
          "-ss",
          "0.5",
          "-i",
          wallpaperPath,
          "-frames:v",
          "1",
          "-vf",
          filter,
          "-y",
          thumbnailPath,
        ],
        null,
        GLib.SpawnFlags.SEARCH_PATH,
        null,
      )
      if (!ok || status !== 0 || !GLib.file_test(thumbnailPath, GLib.FileTest.EXISTS)) {
        return ""
      }
      return thumbnailPath
    }

    const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "bmp", "gif"])
    if (!imageExtensions.has(extension)) return ""

    // Decode and resize through ffmpeg, which keeps the source RGB channels
    // intact across GdkPixbuf's image loader / JPEG encoder path.
    const filter =
      "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,setsar=1"
    const [ok, , , status] = GLib.spawn_sync(
      null,
      [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        wallpaperPath,
        "-frames:v",
        "1",
        "-vf",
        filter,
        "-q:v",
        "3",
        "-y",
        thumbnailPath,
      ],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null,
    )
    if (!ok || status !== 0 || !GLib.file_test(thumbnailPath, GLib.FileTest.EXISTS)) {
      throw new Error(`No se pudo generar una miniatura en color para ${wallpaperPath}`)
    }
    return thumbnailPath
  } catch (error) {
    console.warn(`No se pudo crear la miniatura de ${wallpaperPath}:`, error)
    return ""
  }
}

function ThemePreview({ theme, onSelect }: any) {
  const themeName = createComputed(() => theme()?.name ?? "")
  const wallpaperPath = createComputed(() =>
    getWallpaperPath(theme()?.wallpaper ?? ""),
  )

  return (
    <box
      class="theme-card"
      orientation={Gtk.Orientation.VERTICAL}
      $={(self: Gtk.Box) => {
        const click = Gtk.GestureClick.new()
        click.connect("pressed", () => {
          const currentTheme = theme()
          if (currentTheme) onSelect(currentTheme)
        })
        self.add_controller(click)
      }}
    >
      <box
        class="wallpaper-preview-frame"
        $={(self: Gtk.Box) => {
          self.set_size_request(320, 180)
          const picture = new Gtk.Picture()
          picture.set_can_shrink(true)
          picture.set_content_fit(Gtk.ContentFit.CONTAIN)
          picture.set_halign(Gtk.Align.CENTER)
          picture.set_valign(Gtk.Align.CENTER)
          picture.set_size_request(320, 180)
          picture.add_css_class("wallpaper-preview")
          self.append(picture)

          let displayedPath: string | null = null
          let updateIdle = 0

          const updatePicture = () => {
            if (updateIdle) GLib.source_remove(updateIdle)
            updateIdle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
              updateIdle = 0
              const path = wallpaperPath()
              if (!path || !GLib.file_test(path, GLib.FileTest.EXISTS)) {
                picture.set_paintable(null)
                displayedPath = null
                return GLib.SOURCE_REMOVE
              }

              // Thumbnail generation (including ffmpeg for videos) is synchronous.
              // Defer it until after map/layout so opening the selector doesn't
              // stall GDK's frame clock while it is preparing the first frame.
              const thumbnailPath = createWallpaperThumbnail(path)
              if (wallpaperPath() !== path) return GLib.SOURCE_REMOVE
              if (!thumbnailPath) {
                picture.set_paintable(null)
                displayedPath = null
                return GLib.SOURCE_REMOVE
              }

              if (displayedPath !== thumbnailPath) {
                picture.set_filename(thumbnailPath)
                displayedPath = thumbnailPath
              }
              return GLib.SOURCE_REMOVE
            })
          }

          updatePicture()
          wallpaperPath.subscribe(() => {
            picture.set_paintable(null)
            displayedPath = null
            updatePicture()
          })
        }}
      />
      <box class="preview-name-box" orientation={Gtk.Orientation.VERTICAL}>
        <label class="preview-name" label={themeName} wrap={true} />
      </box>
    </box>
  )
}

interface ThemeSelectorWindowProps {
  onClose: () => void
}

function ThemeSelectorWindow({ onClose }: ThemeSelectorWindowProps) {
  const [selectedThemeGetter, selectedThemeSetter] = createState<string | null>(
    null,
  )
  const [indexGetter, indexSetter] = createState(0)
  const [themesGetter, themesSetter] = createState(loadThemes())
  const [loadingGetter, loadingSetter] = createState(false)
  const [loadingMessageGetter, loadingMessageSetter] = createState("")

  const selectedTheme = createComputed(() => selectedThemeGetter())
  const index = createComputed(() => indexGetter())
  const loading = createComputed(() => loadingGetter())
  const loadingMessage = createComputed(() => loadingMessageGetter())
  const themes = createComputed(() => themesGetter())

  const refreshThemes = () => {
    const refreshedThemes = loadThemes()
    const currentThemes = themes()
    const unchanged =
      currentThemes.length === refreshedThemes.length &&
      currentThemes.every((theme, index) => {
        const refreshed = refreshedThemes[index]
        return (
          theme.id === refreshed.id &&
          theme.name === refreshed.name &&
          theme.desc === refreshed.desc &&
          theme.color === refreshed.color &&
          theme.wallpaper === refreshed.wallpaper &&
          theme.path === refreshed.path
        )
      })

    if (unchanged) return
    themesSetter(refreshedThemes)
    if (refreshedThemes.length === 0) {
      indexSetter(0)
      return
    }
    indexSetter(Math.min(index(), refreshedThemes.length - 1))
  }

  const applySelectedTheme = async (themeId: string) => {
    loadingSetter(true)
    selectedThemeSetter(themeId)

    const sourcePath = themes().find((theme) => theme.id === themeId)?.path
    const targetPath = `${THEMES_DIR}/theme.json`

    loadingMessageSetter("Aplicando tema...")
    try {
      if (!sourcePath) throw new Error(`No se encuentra el tema ${themeId}`)
      const [ok, content] = GLib.file_get_contents(sourcePath)
      if (ok) {
        GLib.file_set_contents(targetPath, content)
        await runThemeScripts()
      }
    } catch (e) {
      console.error("Error aplicando tema:", e)
    }
    await new Promise((r) => setTimeout(r, 300))

    try {
      await applyTheme()
    } catch (e) {
      console.error("Error aplicando tema:", e)
    }

    loadingSetter(false)
    loadingMessageSetter("")
  }

  const handleThemeSelect = (theme: Theme) => {
    applySelectedTheme(theme.id)
  }

  const prevTheme = () => {
    if (themes().length === 0) return
    const current = index()
    const newIndex = current > 0 ? current - 1 : themes().length - 1
    indexSetter(newIndex)
  }

  const nextTheme = () => {
    if (themes().length === 0) return
    const current = index()
    const newIndex = current < themes().length - 1 ? current + 1 : 0
    indexSetter(newIndex)
  }

  const currentTheme = createComputed(() => themes()[index()] ?? null)
  let rootWidget: Gtk.Widget | null = null

  return (
    <window
      name="theme-selector"
      visible={false}
      anchor={Astal.WindowAnchor.CENTER}
      layer={Astal.Layer.OVERLAY}
      application={app}
      keymode={Astal.Keymode.EXCLUSIVE}
    >
      <box
        class="theme-selector-window"
        orientation={Gtk.Orientation.VERTICAL}
        focusable={true}
        $={(self: Gtk.Widget) => {
          rootWidget = self
          const keys = Gtk.EventControllerKey.new()
          keys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
          keys.connect("key-pressed", (_controller, keyval: number) => {
            if (keyval === Gdk.KEY_Escape) {
              onClose()
              return true
            }
            if (keyval === Gdk.KEY_Left) {
              prevTheme()
              return true
            }
            if (keyval === Gdk.KEY_Right) {
              nextTheme()
              return true
            }
            if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
              const currentTheme = themes()[index()]
              if (currentTheme) handleThemeSelect(currentTheme)
              return true
            }
            return false
          })
          self.add_controller(keys)
          self.connect("map", () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
              refreshThemes()
              self.grab_focus()
              return GLib.SOURCE_REMOVE
            })
          })
        }}
      >
        <box class="preview-container" orientation={Gtk.Orientation.HORIZONTAL} spacing={10}>
          <box
            class="theme-nav-box"
            cursor={Gdk.Cursor.new_from_name("pointer", null)}
            $={(self: Gtk.Box) => {
              const click = Gtk.GestureClick.new()
              click.connect("pressed", prevTheme)
              self.add_controller(click)
            }}
          >
            <label class="theme-nav-arrow" label="‹" />
          </box>
          {themes().length > 0 ? (
            <ThemePreview theme={currentTheme} onSelect={handleThemeSelect} />
          ) : (
            <box class="theme-card" valign={Gtk.Align.CENTER}>
              <label label="No hay temas disponibles" />
            </box>
          )}
          <box
            class="theme-nav-box"
            cursor={Gdk.Cursor.new_from_name("pointer", null)}
            $={(self: Gtk.Box) => {
              const click = Gtk.GestureClick.new()
              click.connect("pressed", nextTheme)
              self.add_controller(click)
            }}
          >
            <label class="theme-nav-arrow" label="›" />
          </box>
        </box>

        <box class="footer" orientation={Gtk.Orientation.VERTICAL}>
          <label class="hint" label="← → desplazamiento  |  ENTER aplicar  |  ESC cancelar" />
        </box>
      </box>
    </window>
  )
}

export function getThemeSelector() {
  let selectorWindow: any = null

  const window = (
    <ThemeSelectorWindow
      onClose={() => {
        if (selectorWindow) selectorWindow.visible = false
      }}
    />
  )
  selectorWindow = window

  return {
    window,
    toggle: () => {
      selectorWindow.visible = !selectorWindow.visible
    },
    show: () => {
      selectorWindow.visible = true
    },
    hide: () => {
      selectorWindow.visible = false
    },
  }
}

export default function ThemeSelector() {
  return getThemeSelector()
}
