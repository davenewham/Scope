let socket = io("wss://" + window.location.host, {});

let reconnect_timer = null;

socket.on('lobbyUpdate', ({players}) =>{
  console.log(players)
  lobbyUpdated(players);
});

socket.on('updateGameState', (stateInfo) =>{
  if (stateInfo.state == "starting") {
    preGameStart(stateInfo.cooldown);
  }
});

socket.on('updateGameSettings', ({settings}) => {
  gameSettings = settings;
});

socket.on('assignGunID', ({GunID}) =>{
  playerGameData.gunID = GunID;
});

socket.on('updateWeaponDefinitions', ({weapons}) =>{
  weaponDefinitions = weapons;
});

socket.on('playerListUpdate', ({players}) =>{
  playerList = players;
});

socket.on('kill', () => {
  enemyKilled();
});

socket.on('gameAlreadyStarted', () => {
  // prohibit joinning games that already started, but only when the player is not in a running game
  // it should be possible to remove the first if-statement once the reconnecting is fixed
  if (!document.getElementById('ftsetup').style.display || document.getElementById('ftsetup').style.display != "none") {
    document.getElementById('splash').style.display = 'block';
    document.getElementById('ftsetup').style.display = 'none';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';

    // okay, just hide the whole body, because the other elements could be displayed again
    document.querySelector('body').style.display = 'none'
    alert('Game already started. Please come back later.')
  }
});


socket.on('connect', () => {
  if ((reconnect_timer !== null)) {
    clearInterval(reconnect_timer);
    reconnect_timer = null;
  }

  // reconnect if player already had a username and an uuid
  if (username && uuid) {
    socket.emit("reconnect", {uuid: uuid})
  }
  // first join if player doesn't have these attributes yet
  else {
    socket.emit("join");
  }
});

socket.on('disconnect', () => {
  console.log("WebSocket closed, needing for reconnection.");
  if (reconnect_timer === null) {
    reconnect_timer = setInterval(() => {
      reconnect();
    }, 3000);
  }
});

function reconnect() {
  console.log("Trying to reconnect to server ...")
  // probably bad pratice
  socket = io("wss://" + window.location.host, {});
  connect();
}
