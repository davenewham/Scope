// Game
var lobbyRoster = document.getElementById("roster");
var readyBtn = document.getElementById("readyBtn");
var leaderBoard = document.getElementById("leaderboard");
var continueBtn = document.getElementById("continueButton");
var startCountdown = null;
var respawnCountdown = null;
var gameTimer = null;
var secondsLeft = 0;
var gameSettings = {};

// Player
var playerSettings = {
  vibrateOnHit: true,
  recoil: true,
};
var playerGameData = {};
var playerHealth = 100;
var playerState = "alive";
var playerInv = {};
var deathList = [];
var kills = 0;
var playerList = [];

//Gun
var reloading = false;
/**
 * @type {weaponDefinition}
 */
var currentWeapon = {};
var loadedAmmo = 50;
var availableRoundsLeft = 20;
/**
 * @type {weaponDefinition[]}
 */
var weaponDefinitions = [
];

//Lobby stuff
function lobbyUpdated(players) {
  lobbyRoster.innerHTML = "";
  players.forEach((player, i) => {
    let container = document.createElement("DIV");
    let text = document.createElement("H3");
    container.classList.add('player');
    text.innerHTML = player.username;
    container.appendChild(text);
    lobbyRoster.appendChild(container);
  });
}

/**
 * Is executed every time the "ready" button is pressed to send the ready state to the server.
 */
function ready() {
  if (readyBtn.classList.contains("readyBtnPressed")) {
    readyBtn.classList.remove("readyBtnPressed");
    socket.send(JSON.stringify({ 'msgType': 'setState', 'state': 'lobby' }));
  } else {
    readyBtn.classList.add("readyBtnPressed");
    socket.send(JSON.stringify({ 'msgType': 'setState', 'state': 'ready' }));
  }
}

function preGameStart(cooldown) {
  // audio test stuff
  loadSound(SOUND_GUNSHOT, "/assets/audio/1911/1911_shot.wav");
  loadSound(SOUND_RELOAD, "/assets/audio/1911/1911_reload.wav");

  readyGun();
  document.getElementById("countdown").style.display = "grid";
  document.getElementById("lobby").style.display = "none";
  let countdown = cooldown / 1000;
  document.getElementById("startCountdownNumber").innerHTML = countdown;
  startCountdown = setInterval(() => {
    if (countdown <= 1) {
      startGame();
      clearInterval(startCountdown);
      document.getElementById("countdown").style.display = "none";
    } else {
      countdown = countdown - 1;
      document.getElementById("startCountdownNumber").innerHTML = countdown;
    }
  }, 1000);
  //show countdown stuff hide all setup stuff
}

function startGame() {
  startGun();
  console.log("Game Started");
  secondsLeft = gameSettings.gameTimeMins * 60;
  timer();
  gameTimer = setInterval(timer, 1000);
  syncIndicators();
  startMap();
}

function endGame() {
  console.log("Game Ended");
  stopMap();
  showLeaderboard();
}

function showLeaderboard() {
  let fade = [
    { opacity: "0" },
    { opacity: "1" },
  ];
  leaderBoard.style.display = "grid";
  leaderBoard.animate(fade, 500);
}

function backToLobby() {
  readyBtn.classList.remove("readyBtnPressed");
  document.getElementById("lobby").style.display = "grid";
  let fade = [
    { opacity: "1" },
    { opacity: "0" },
  ];
  leaderBoard.animate(fade, 500).finished.then(() => {
    leaderBoard.style.display = "none";
  });
}

function readyGun() {
  currentWeapon = findWeapon(gameSettings.defaultWeapon);
  RecoilGun.gunSettings.shotId = playerGameData.gunID;
  RecoilGun.gunSettings.recoil = playerSettings.recoil;
  RecoilGun.updateSettings();
  weaponDefinitions.forEach((weapon, i) => {
    RecoilGun.setWeaponProfile(weapon.behavior, weapon.slotID);
  });
  RecoilGun.switchWeapon(currentWeapon.slotID);
}

function startGun() {
  if (gameSettings.startAmmo == "full") {
    loadedAmmo = currentWeapon.maxLoadedAmmo;
    availableRoundsLeft = currentWeapon.maxLoadedAmmo * currentWeapon.maxClips;
  } else {
    loadedAmmo = 0;
    availableRoundsLeft = 0;
  }
  RecoilGun.loadClip(loadedAmmo);
  updateAmmo();
}

/**
 * @param {string} name
 * @returns WeaponDefinition
 */
function findWeapon(name) {
  let theWeapon = null;
  weaponDefinitions.forEach((weapon, i) => {
    if (weapon.name == name) {
      theWeapon = weapon;
    }
  });
  if (theWeapon !== null) {
    return theWeapon;
  } else {
    console.log("Could not find weapon:", name);
  }
}

function getPlayerFromID(shotID) {
  console.log("Shots fired. Shot ID:");
  console.log(shotID);

  // workaround test: substract one from the shotID
  shotID = shotID - 1;

  let thePlayer = null;
  playerList.forEach((player, i) => {
    if (player.gunID == shotID) {
      thePlayer = player;
    }
  });
  if (thePlayer !== null) {
    return thePlayer;
  } else {
    console.log("Could not find player:", name);
    return null;
  }
}

function timer() {
  secondsLeft = secondsLeft - 1;
  let mins = Math.floor(secondsLeft / 60);
  let seconds = secondsLeft % 60;
  let clock = mins.toString() + ":" + seconds.toString().padStart(2, '0');
  document.getElementById("gameTimerElement").innerHTML = clock;
  if (secondsLeft <= 0) {
    endGame();
    clearInterval(gameTimer);
  }
}

function syncIndicators() {
  updateAmmo();
  updateHealth();
  updateStats();
}

function reload() {
  if (playerState === "dead") {
    // dead players can't shoot :^)
    return;
  }

  if (!reloading) {
    reloading = true;
    playSound(SOUND_RELOAD);
    RecoilGun.removeClip();
    updateAmmo();
    setTimeout(() => {
      if (gameSettings.dropAmmoOnReload) {
        availableRoundsLeft = availableRoundsLeft - currentWeapon.maxLoadedAmmo;
        loadedAmmo = currentWeapon.maxLoadedAmmo;
      } else {
        availableRoundsLeft = availableRoundsLeft - (currentWeapon.maxLoadedAmmo - loadedAmmo);
        loadedAmmo = currentWeapon.maxLoadedAmmo;
      }
      if (availableRoundsLeft < 0) {
        loadedAmmo = loadedAmmo + availableRoundsLeft;
        availableRoundsLeft = 0;
      }
      RecoilGun.loadClip(loadedAmmo);
      reloading = false;
      updateAmmo();
    }, 1000);
  }
}

function updateAmmo() {
  if (reloading) {
    document.getElementById("ammoDisplayElement").innerHTML = "--/--";
  } else {
    document.getElementById("ammoDisplayElement").innerHTML = loadedAmmo + "/" + availableRoundsLeft;
  }
}
/**
 * @param {null | number} ammo
 */
function ammoChanged(ammo) {
  if (ammo !== null) {
    if (ammo < loadedAmmo) {
      playSound(SOUND_GUNSHOT);
    }
    loadedAmmo = ammo;
    updateAmmo();
  }
}

function updateStats() {
  document.getElementById("kills").innerHTML = kills.toString();
  document.getElementById("ingameleaderboard").innerHTML = "1st";
  document.getElementById("deaths").innerHTML = deathList.length.toString();
}

function updateHealth() {
  document.getElementById("healthBar").value = playerHealth;
}

function irEvent(event) {
  if (playerState === "dead") {
    return;
  }

  const { weaponID, shooterID } = event;
  const weapon = weaponDefinitions.find(w => w.slotID === weaponID);
  const damage = weapon ? weapon.damage : 0;

  if (damage > 0) {
    showHit();
    playerHealth = playerHealth - damage;
    updateHealth();

    if (playerHealth <= 0) {
      // Player is dead
      const deathInfo = {
        shooterID: shooterID,
        weapon: weaponID,
        time: new Date()
      };
      deathList.push(deathInfo);
      dead(deathInfo);
    }
  }
}

var hitAnimation = [
  { opacity: "1" },
  { opacity: "0" },
];

function showHit() {
  document.getElementById("hit").animate(hitAnimation, 600);
  if (playerSettings.vibrateOnHit) {
    navigator.vibrate([100]);
  }
}

function dead(deathInfo) {
  let countdown = gameSettings.deadTimeSeconds;
  updateDeathScreen();
  document.getElementById("respawnTimer").innerHTML = countdown;
  RecoilGun.removeClip();
  socket.send(JSON.stringify({ "msgType": "kill", "info": deathInfo }));
  stopMap();
  document.getElementById("death").style.display = "block";
  playerState = "dead";
  //setTimeout(respawn, 5000);
  respawnCountdown = setInterval(() => {
    if (countdown <= 1) {
      clearInterval(respawnCountdown);
      respawn();
    } else {
      countdown = countdown - 1;
      document.getElementById("respawnTimer").innerHTML = countdown;
    }
  }, 1000);
}

function enemyKilled() {
  kills = kills + 1;
  updateStats();
  // see ya...
}

function updateDeathScreen() {
  let death = deathList[deathList.length - 1];

  // try to get the player name, write unknown otherwise
  try {
    document.getElementById("killedBy").innerHTML = getPlayerFromID(death.shooterID).username;
  } catch (error) {
    document.getElementById("killedBy").innerHTML = "Unknown";
  }

  let killWeapon = "Rick roll";
  weaponDefinitions.forEach((weapon, i) => {
    if (weapon.slotID == death.weapon) {
      killWeapon = weapon.name;
    }
  });
  document.getElementById("killedWith").innerHTML = killWeapon;
}

function respawn() {
  startMap();
  playerState = "alive";
  playerHealth = 100;
  loadedAmmo = currentWeapon.maxLoadedAmmo;
  availableRoundsLeft = currentWeapon.maxClips * currentWeapon.maxLoadedAmmo;
  syncIndicators();
  document.getElementById("death").style.display = "none";
  RecoilGun.loadClip(loadedAmmo);
}

/**
 * set the event listeners
 */
continueBtn.addEventListener("click", backToLobby);
readyBtn.addEventListener("click", ready);
document.getElementById("connectGunbtn").addEventListener("click", () => {
  console.log("Connecting to gun.");
  RecoilGun.connect().then(() => {
    bleSuccess();
    RecoilGun.gunSettings.shotId = 2;
    RecoilGun.gunSettings.recoil = false;
    RecoilGun.on("irEvent", irEvent);
    RecoilGun.on("ammoChanged", ammoChanged);
    RecoilGun.on("reloadBtn", reload);
    RecoilGun.switchWeapon(2);
    RecoilGun.startTelemetry();
    RecoilGun.updateSettings();
  }).catch((error) => {
    console.log("Failure to connect", error);
    bleFailure();
  });
});

window.onbeforeunload = (evt) => {
  evt.preventDefault();
  return evt.returnValue = '';
}