var socket = new window.WebSocket("wss://" + window.location.host);
var reconnect_timer = null;

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
let reconnectMsg = { "msgType": "reconnect", "username": "" };
function onOpen() {
  if ((reconnect_timer !== null)) {
    clearInterval(reconnect_timer);
    reconnect_timer = null;
  }

  if (username === undefined || username === null || username === "") {
    socket.send(JSON.stringify(initMsg));
  } else {
    reconnectMsg["username"] = username;
    socket.send(JSON.stringify(reconnectMsg))
  }
}

function onClose() {
  console.log("WebSocket closed, needing for reconnection.");
  if (reconnect_timer === null) {
    reconnect_timer = setInterval(() => {
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