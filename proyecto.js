import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import Left from "./bar/Left.js"
import Center from "./bar/Center.js"
import Right from "./bar/Right.js"
import { applyTheme, watchTheme } from "./themeEngine.js"
import { getOverlay } from "./widgets/Overlay.js"
import { getCalendarPopup } from "./widgets/CalendarPopup.js"

app.start({
  main: async () => {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    const overlay = getOverlay()
    const calendarPopup = getCalendarPopup()

    await applyTheme()
    watchTheme()

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
    ]
  },
})
