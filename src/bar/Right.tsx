import Memory from "../widgets/Memory.tsx"
import Battery from "../widgets/Battery.tsx"
import Cpu from "../widgets/Cpu.tsx"
import Temperature from "../widgets/Temperature.tsx"
import Network from "../widgets/Network.tsx"
import PowerMenu from "../widgets/PowerMenu.tsx"

export default () => (
  <box class="bar-section right">
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
