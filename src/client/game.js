// Game
let lobbyRoster = document.getElementById("roster");
let readyBtn = document.getElementById("readyBtn");
let leaderBoard = document.getElementById("leaderboard");
let continueBtn = document.getElementById("continueButton");
let startCountdown = null;
let respawnCountdown = null;
let gameTimer = null;
let secondsLeft = 0;
let gameSettings = {};

// Player
let playerSettings = {
  vibrateOnHit: true,
  recoil: true,
};
let playerGameData = {};
let playerHealth = 100;
let playerState = "alive";
let playerInv = {};
let deathList = [];
let kills = 0;
let playerList = [];

//Gun
let reloading = false;
/**
 * @type {weaponDefinition}
 */
let currentWeapon = {};
let loadedAmmo = 50;
let availableRoundsLeft = 20;
/**
 * @type {weaponDefinition[]}
 */
let weaponDefinitions = [
];

//Lobby stuff
function lobbyUpdated(players) {

  lobbyRoster.innerHTML = "";
  players.forEach((player, i) => {
    if ((uuid === null || uuid === "") && (player.username === username)) {
      uuid = player.uuid;
    }
    let container = document.createElement("DIV");
    let text = document.createElement("H3");
    container.classList.add('player');
    text.innerHTML = player.username;
    if (player.ready) {
      text.innerHTML += " - <u>Ready</u>"
    }
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
  loadSound(SOUND_GUNSHOT, "/audio/1911/1911_shot.wav");
  loadSound(SOUND_RELOAD, "/audio/1911/1911_reload.wav");

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
}

function backToLobby() {
  readyBtn.classList.remove("readyBtnPressed");
  document.getElementById("lobby").style.display = "grid";
  leaderBoard.style.display = "none";
}

function readyGun() {
  currentWeapon = findWeapon(gameSettings.defaultWeapon);
  RecoilGun.gunSettings.shotId = playerGameData.gunID;
  // Let the gun know we want this ID!
  RecoilGun.setGunId(playerGameData.gunID);
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
  console.debug("Receieved shot from Shot ID:", shotID, "checking current playerlist", playerList);
  return playerList.find(player => player.gunID === shotID) ||
    console.log("Could not find player with Shot ID:", shotID, "in", playerList);
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
      let deathInfo = {
        shooterID: shooterID,
        shooterName: getPlayerFromID(shooterID).username,
        killedName: username,
        weapon: event.weaponID,
        time: new Date()
      }
      deathList.push(deathInfo);
      dead(deathInfo);
    }
  }
}

function showHit() {
  // hit animation
  hitElement = document.getElementById("hit");
  hitElement.style.opacity = 1;
  setTimeout(() => {
    hitElement.style.opacity = 0;
  }, 600);

  // hit haptic feedback
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