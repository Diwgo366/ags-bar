import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import Left from "./Left.tsx"
import Center from "./Center.tsx"
import Right from "./Right.tsx"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      name="bar"
      visible
      anchor={TOP | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      namespace="bar"
      application={app}
      gdkmonitor={gdkmonitor}
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
    </window>
  )
}
