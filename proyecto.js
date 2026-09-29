import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "ags"
import Left from "./bar/Left.js"
import Center from "./bar/Center.js"
import Right from "./bar/Right.js"
import { applyTheme, watchTheme } from "./themeEngine.js"
import { getOverlay } from "./widgets/Overlay.js"
import { getCalendarPopup } from "./widgets/CalendarPopup.js"
import { getThemeSelector } from "./widgets/ThemeSelector.js"

// CSS for theme selector
const themeSelectorCSS = `
.theme-selector-container {
    background: #1e1e2e;
    border-radius: 16px;
    margin: 40px;
    padding: 24px;
}
.theme-selector-title {
    font-size: 24px;
    color: #f8f8f2;
    margin-bottom: 16px;
}
.theme-selector-hint {
    color: #6272a4;
}
`

const provider = new Gtk.CssProvider()
provider.load_from_string(themeSelectorCSS)
const display = Gdk.Display.get_default()
Gtk.StyleContext.add_provider_for_display(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

app.start({
  main() {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    const overlay = getOverlay()
    const calendarPopup = getCalendarPopup()
    const themeSelector = getThemeSelector()

    // Keybind for SUPER + T to toggle theme selector
    const keybind = Gtk.EventControllerKey.new()
    keybind.connect("key-pressed", (_, keyval, _keycode, mask) => {
        if (keyval === Gdk.KEY_t && (mask & Gdk.ModifierType.MOD4_MASK)) {
            themeSelector.toggle()
            return true
        }
        return false
    })
    app.add_controller(keybind)

    // Apply theme (fire and forget - main must be sync)
    applyTheme().then(() => {
        watchTheme()
    })

    return [
      <window
        name="bar"
        visible
        anchor={TOP | LEFT | RIGHT}
        exclusivity={Astal.Exclusivity.EXCLUSIVE}
        application={app}
      >
        <centerbox>
          <box $type="start">
            <Left />
          </box>
          <box $type="center">
            <Center />
          </box>
          <box $type="end">
            <Right />
          </box>
        </centerbox>
      </window>,
      overlay.window,
      calendarPopup.window,
      themeSelector.window,
    ]
  },
})
