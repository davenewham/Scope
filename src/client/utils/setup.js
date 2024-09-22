import { getSocket } from '../services/networking.js';
import { enterFullscreen, setWakeLock,fakeFullscreenAndWakeLock, wakeLock, fullscreen  } from './utils.js'
import { phoneInfo } from './phoneinfo.js';

// it's nonsense that this file is also requiring to directly call ws.
// TODO: refactor
let socket;

// variables
let username;
let storedUsername;
//let gunChoice;

let fullScreenPermBtn = document.getElementById("fullscreenPerm");
let wakeLockPermBtn = document.getElementById("wakeLockPerm");
let locationPermBtn = document.getElementById("locationPerm");

window.onload = function() {
  socket = getSocket();
  console.log(socket)
  if (!phoneInfo.bluetoothAvailable) {
    document.getElementById("incompatable").style.display = "grid";
  }
  storedUsername = localStorage.getItem("username");
  if (storedUsername != undefined) {
    document.getElementById("username").value = storedUsername;
  }
  document.getElementById("splash").style.display = "none";
  document.getElementById("ftsetup").style.display = "block";
  document.getElementById("setupusername").style.display = "grid";
  fullScreenPermBtn.addEventListener("click", (event) => enterFullscreen(event.target));
  window.addEventListener("keydown", (e) => {
    if (e.key === "f") {
      fakeFullscreenAndWakeLock(fullScreenPermBtn, wakeLockPermBtn);
    }
  })
  console.log("press f on desktop to skip to pairing");
  wakeLockPermBtn.addEventListener("click", (event) => setWakeLock(event.target));
  locationPermBtn.addEventListener("click", allowGPS);
  document.getElementById("splash").style.display = "none";
};
window.submitUsername = submitUsername;
export function submitUsername() {+
  console.log(socket)
  socket.emit("join");
  username = document.getElementById("username").value;
  // if ((username == "") && (storedUsername != undefined)) {
  //   username = storedUsername;
  // }
  if (username == "") {
    alert("You can't play without a username :/");
  } else if (username.length > 13) {
    alert("Username cannot be longer than 13.1473894 characters");
  } else if (username.replace(/ /g, '').length < 2) {
    alert("Username cannot be shorter than 2 characters");
  } else {
    localStorage.setItem("username", username);
    socket.emit("setUsername",
    { username: username });
    showPhoneSetupMenu();
    document.getElementById("setupusername").style.display = "none";
  }
}

export function allowGPS() {
  if (navigator.geolocation) {
    console.log(navigator.geolocation.getCurrentPosition(geoSuccess, (error)=>{
      switch(error.code) {
        case error.PERMISSION_DENIED:
          alert("Looks like location is denied. To enable it, tap the triangle or padlock to the left of the address bar, tap permissions, and allow location.");
          break;
        case error.POSITION_UNAVAILABLE:
          alert("Looks like geolocation is available but also unavailable? (What?!?)");
          break;
        case error.TIMEOUT:
          alert("ARRG! Somehow gps timed out.");
          break;
        case error.UNKNOWN_ERROR:
          alert("Ouch. Gps exists but raised an unknown error.");
          break;
      }
    }));
  } else {
    alert("Hmm, looks like your browser doesn't support geolocation... or its disabled.");
  }
}

export function geoSuccess(position) {
  if (position != undefined) {
    console.log("GPS is enabled.");
    locationPermBtn.classList.add("permAllowed");
    phoneInfo.locationEnabled = true;
    checkPerms();
  }
}

export function bleSuccess() {
  document.getElementById("lobby").style.display = "grid";
  document.getElementById("setupgun").style.display = "none";
  document.getElementById("ftsetup").style.display = "none";
  socket.emit('game', {msgType: 'setState'}, { state: 'lobby' });
}
export function bleFailure(error) {
  document.getElementById("connectGunbtn").classList.add('greenbtn');
  document.getElementById("connectGunbtn").classList.remove('disabledbtn');
}
export function bleSetLoading() {
  document.getElementById("connectGunbtn").classList.add('disabledbtn');
  document.getElementById("connectGunbtn").classList.remove('greenbtn');
}

export function showPhoneSetupMenu() {
  if (phoneInfo.wakeLockAvailable) {
    wakeLockPermBtn.style.display = "grid";
  } else {
    wakeLockPermBtn.style.display = "none";
  }
  if (phoneInfo.locationEnabled) {
    locationPermBtn.classList.add("permAllowed");
  } else {
    locationPermBtn.style.display = "grid";
  }
  if (phoneInfo.fullscreenAvailable) {
    fullScreenPermBtn.style.display = "grid";
  } else {
    fullScreenPermBtn.style.display = "none";
  }

  document.getElementById("setupphone").style.display = "grid";
}

export function showGunSetupMenu() {
  document.getElementById("setupgun").style.display = "grid";
}

export function checkPerms() {
  let ready = true;
  if (phoneInfo.fullscreenAvailable) {
    if (fullscreen != true) {
      ready = false;
    }
  }
  if (phoneInfo.wakeLockAvailable) {
    if (wakeLock == null) {
      ready = false;
    }
  }
  if (!phoneInfo.locationEnabled) {
    ready = false;
  }
  if (ready) {
    showGunSetupMenu();
    document.getElementById("setupphone").style.display = "none";
  }
}
