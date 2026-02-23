import { settingsApi } from "./clientApi";

const handleResize = () =>
{
  settingsApi.api.settings({ id: 'windowSize' }).post({ value: { width: window.innerWidth, height: window.innerHeight } });
};
window.addEventListener("resize", handleResize);
import.meta.hot.dispose(() => window.removeEventListener('resize', handleResize));

let lastWindowPosX: number = window.screenX;
let lastWindowPosY: number = window.screenY;
var screenPositionInternal: NodeJS.Timeout = setInterval(() =>
{
  if (lastWindowPosX != window.screenX || lastWindowPosY != window.screenY)
  {
    settingsApi.api.settings({ id: 'windowPosition' }).post({ value: { x: window.screenX, y: window.screenY } });
  }

  lastWindowPosX = window.screenX;
  lastWindowPosY = window.screenY;
}, 1000);
import.meta.hot.dispose(() => clearInterval(screenPositionInternal));