import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import Left from "./bar/Left.js"
import Center from "./bar/Center.js"
import Right from "./bar/Right.js"
import { getHyprOptions, generateCSS, watchConfig } from "./hyprconfig.js"
import { getOverlay } from "./widgets/Overlay.js"

app.start({
  main() {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    const display = Gdk.Display.get_default()

    let provider = null

    const overlay = getOverlay()

    async function refreshCSS() {
      try {
        const opts = await getHyprOptions()
        const css = generateCSS(opts)

        if (provider)
          Gtk.StyleContext.remove_provider_for_display(display, provider)

        provider = new Gtk.CssProvider()
        provider.load_from_string(css)
        Gtk.StyleContext.add_provider_for_display(
          display, provider,
          Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )
      } catch (e) {
        logError(e)
      }
    }

    refreshCSS()
    watchConfig(refreshCSS)

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
    ]
  },
})
