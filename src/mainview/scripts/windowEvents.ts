import { settingsApi } from "./clientApi";

window.addEventListener("resize", () =>
{
  settingsApi.api.settings({ id: 'windowSize' }).post({ value: { width: window.innerWidth, height: window.innerHeight } });
});

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