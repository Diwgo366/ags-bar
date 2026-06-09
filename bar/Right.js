import Tasks from "../widgets/Tasks.js"
import Memory from "../widgets/Memory.js"
import Battery from "../widgets/Battery.js"
import Cpu from "../widgets/Cpu.js"
import Temperature from "../widgets/Temperature.js"
import Network from "../widgets/Network.js"
import PowerMenu from "../widgets/PowerMenu.js"

export default () => (
  <box class="right">
    <Tasks />
    <box class="separator" />
    <Cpu />
    <box class="separator" />
    <Memory />
    <box class="separator" />
    {/* <Temperature />
    <box class="separator" />  */}
    <Battery />
    <box class="separator" />
    <Network />
    <box class="separator" />
    <PowerMenu />
  </box>
)
