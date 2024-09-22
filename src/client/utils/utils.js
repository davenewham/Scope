import { checkPerms } from "./setup";

export let wakeLock = null;
export let fullscreen = false;

//  Wakelock stuff
export async function setWakeLock(element) {
  element.classList.add("permAllowed");
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('Screen Wake Lock was released');
      });
      console.log('Screen Wake Lock is active');
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  }
  checkPerms();
}
export function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

//  Fullscreen stuff
export function enterFullscreen(element) {
  document.documentElement.requestFullscreen();
  screen.orientation.lock('portrait');
  fullscreen = true;
  element.classList.add("permAllowed");
  checkPerms();
}
export function fakeFullscreenAndWakeLock(fullScreenElement, wakeLockElement) {
  // for debugging on desktop
  fullscreen = true;
  wakeLock = true;
  fullScreenElement.classList.add("permAllowed");
  wakeLockElement.classList.add("permAllowed");
  checkPerms();
}
export function exitFullscreen() {
  document.exitFullscreen();
}