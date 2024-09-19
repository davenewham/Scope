let wakeLock = null;
let fullscreen = false;

//  Wakelock stuff
async function setWakeLock() {
  wakeLockPermBtn.classList.add("permAllowed");
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
function releaseWakeLock() {
  try {
    wakeLock.release();
  } catch (err) {
    console.error(`${err.name}, ${err.message}`);
  }
}

//  Fullscreen stuff
function enterFullscreen() {
  document.documentElement.requestFullscreen();
  screen.orientation.lock('portrait');
  fullscreen = true;
  fullScreenPermBtn.classList.add("permAllowed");
  checkPerms();
}
function fakeFullscreenAndWakeLock() {
  // for debugging on desktop
  fullscreen = true;
  wakeLock = true;
  fullScreenPermBtn.classList.add("permAllowed");
  wakeLockPermBtn.classList.add("permAllowed");
  checkPerms();
}
function exitFullscreen() {
  document.exitFullscreen();
}


function checkPhoneInfo() {
  // check if geolocation is available
  phoneInfo.locationEnabled = false;
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state === "granted") {
        phoneInfo.locationEnabled = true;
      }

      // listen to geolocation permission changes
      result.onchange = (event) => {
        if (event.target.state == "granted") {
          geoSuccess(1);
        }
      }
    });
  }

  // second attempt on checking geolocation by direct access
  // this is iOS-compatible, but takes longer on other devices
  if (phoneInfo.locationEnabled == false && "geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        phoneInfo.locationEnabled = true;
      }
    );
  }

  // check if fullscreen is available
  if ("requestFullscreen" in document.documentElement) {
    phoneInfo.fullscreenAvailable = true;
  } else {
    phoneInfo.fullscreenAvailable = false;
  }

  // check if wakelock is available
  if ("wakeLock" in navigator) {
    phoneInfo.wakeLockAvailable = true;
  } else {
    phoneInfo.wakeLockAvailable = false;
  }

  // check if bluetooth is available
  if ("bluetooth" in navigator) {
    phoneInfo.bluetoothAvailable = true;
  } else {
    phoneInfo.bluetoothAvailable = false;
  }
}