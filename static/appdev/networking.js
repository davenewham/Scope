var socket = new window.WebSocket("wss://" + window.location.host);
var timer = null;

function onMessage(event) {
  console.log("WebSocket message received:", event.data);
  let message = JSON.parse(event.data);
  switch (message.msgType) {
    case 'lobbyUpdate':
      lobbyUpdated(message.players);
      break;
    case 'updateGameState':
      if (message.state == "starting") {
        preGameStart(message.cooldown);
      }
      break;
    case 'updateGameSettings':
      gameSettings = message.settings;
      break;
    case 'assignGunID':
      playerGameData.gunID = message.GunID;
      break;
    case 'updateWeaponDefinitions':
      weaponDefinitions = message.weapons;
      break;
    case 'playerListUpdate':
      playerList = message.players;
      break;
    case 'kill':
      enemyKilled();
      break;
  }
}

let initMsg = { "msgType": "join" };
function onOpen() {
  clearInterval(timer);
  timer = null;
  socket.send(JSON.stringify(initMsg));
}

function onClose() {
  console.log("WebSocket closed, needing for reconnection.");
  if (timer === null) {
    timer = setInterval(() => {
      reconnect();
    }, 3000);
  }
}

function reconnect() {
  console.log("Trying to reconnect to server ...")
  socket = new window.WebSocket("wss://" + window.location.host);
  connect();
}

function connect() {
  socket.onmessage = onMessage;
  socket.onopen = onOpen;
  socket.onclose = onClose;
}

connect();