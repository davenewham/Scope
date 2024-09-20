const ws_address = "wss://" + window.location.host + "/api";
let socket = new window.WebSocket(ws_address);

let reconnect_timer = null;

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
    case 'gameAlreadyStarted':
      document.getElementById('splash').style.display = 'block';
      alert('Game already started. Please come back later.')
      break;
  }
}

let initMsg = { "msgType": "join" };
let reconnectMsg = { "msgType": "reconnect", "uuid": "" };
function onOpen() {
  if ((reconnect_timer !== null)) {
    clearInterval(reconnect_timer);
    reconnect_timer = null;
  }

  // reconnect if player already had a username and an uuid
  if (username && uuid) {
    reconnectMsg["uuid"] = uuid;
    socket.send(JSON.stringify(reconnectMsg))
  }
  // first join if player doesn't have these attributes yet
  else {
    socket.send(JSON.stringify(initMsg));
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
  socket = new window.WebSocket(ws_address);
  connect();
}

function connect() {
  socket.onmessage = onMessage;
  socket.onopen = onOpen;
  socket.onclose = onClose;
}

connect();