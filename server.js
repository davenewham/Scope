const WebSocket = require("ws");
const express = require("express");
const fsp = require("fs").promises;
const fs = require("fs");
var https = require("https");
var http = require("http");
const stripJsonComments = require("strip-json-comments");
var colors = require('@colors/colors');

const serverPort = 3000;
var defaultSettings;

/**
 * @typedef {Object} weaponDefinition
 * @property {string} name
 * @property {string} description
 * @property {number} slotID
 * @property {number} damage
 * @property {number} maxLoadedAmmo
 * @property {number} maxClips
 * @property {Object} behavior
 * @property {number} behavior.triggerMode
 * @property {number} behavior.rateOfFire
 * @property {number & (>=0) & (<=254)} behavior.muzzleFlashMode
 * @property {number} behavior.flashParam1
 * @property {number} behavior.flashParam2
 * @property {number & (>=0) & (<=255)} behavior.narrowIrPower
 * @property {number & (>=0) & (<=255)} behavior.wideIrPower
 * @property {number & (>=0) & (<=255)} behavior.muzzleLedPower
 * @property {number} behavior.motorPower
 */
/**
 * @type {weaponDefinition[]}
 */
var weaponDefinitions = [];
var socketCounter = 0;

async function loadConf() {
	// load game config
	const defaultSettingsData = await fsp
		.readFile("config/game/default.jsonc")
		.catch((err) => {
			console.error(err);
			return;
		});
	defaultSettings = JSON.parse(stripJsonComments(defaultSettingsData.toString()));

	// Read weapon configs
	let files = await fsp.readdir('config/weapon').catch(err => {
		console.error('Unable to read weapon config directory: ' + err);
		return;
	});
	files.forEach(async file => {
		console.log(colors.yellow("Found weapon config", file));
		let data = await fsp.readFile('config/weapon/' + file).catch(err => { console.log("Failed to read file", err); });
		weaponDefinitions.push(JSON.parse(stripJsonComments(data.toString())));
	});
}

var game = {
	state: "waiting",
	players: [],
	timer: null,
	gameEnd: null,
	settings: null,
	// settings: {
	//   startOnReady: true,
	//   gameTimeMins: 1,
	//   preStartCooldown: 5000,
	//   defaultWeapon: "RK-45",
	//   startAmmo: "full",
	//   telemetry: false,
	//   dropAmmoOnReload: false,
	// },
};

loadConf().then(() => {
	game.settings = defaultSettings;
});
game.id = makeUID(6);
console.log(("Game id: " + game.id).green);

const httpServer = https.createServer(
	{
		key: fs.readFileSync("certs/server.key"),
		cert: fs.readFileSync("certs/server.cert"),
	},
	express()
);

const wss = new WebSocket.Server({ server: httpServer });
httpServer.listen(serverPort, () => {
	console.log("Server listening at https://localhost:3000/".yellow);
});

wss.on("connection", (ws) => {
	ws.id = socketCounter += 1; // Label this socket
	console.log("Websocket Connection | WSID:", ws.id);

	ws.on("message", message => {
		let command = JSON.parse(message);
		console.log(command);
		switch (command.msgType) {
			case "join":
				if (game.state != "waiting") {
					console.log("Join rejected: Game already in progress");
					player.ws.send(ws.id, JSON.stringify({ msgType: "gameAlreadyStarted" }));
					break;
				}
				if (ws.game) {
					console.log("Player has already joined game");
					break;
				}
				// Add user to the player list
				let player = {};
				player.username = undefined;
				player.ws = ws;
				player.uuid = makeUID(10);
				game.players.push(player);
				ws.game = game;
				ws.player = player;
				break;
			case "reconnect":
				if (ws.game) {
					console.log("Player is already connected");
					break;
				}
				let playerdata = game.players.find(player => {
					return player.uuid == command.uuid;
				});
				if (!playerdata) {
					console.log("Could not find player uuid to reconnect");
					break;
				}
				playerdata.ws = ws;
				ws.game = game;
				break;
			case "updateGameSettings":
				game.settings = command.settings;
				break;

			case "updateWeaponDefinitions":
				weaponDefinitions = command.weaponDefinitions;
				break;

			case "setUsername":
				ws.player.username = command.username;
				lobbyUpdate(ws.game.players);
				break;

			default:
				if (ws.game) {
					handleGameMessage(ws, command);
				}
				break;
		}
	});
	ws.on("close", () => {
		let missingPlayerIndex = ws.game.players.findIndex(player => { return player.ws.id == ws.id });
		if (missingPlayerIndex == -1) {
			console.log("could not find player to remove");
			return;
		}
		console.log(`${ws.game.players[missingPlayerIndex].username || "Player"} Disconnected`);
		if (game.state == "waiting") {
			ws.game.players.splice(missingPlayerIndex, 1);
			lobbyUpdate(ws.game.players);
		}
	});
});

function assignPlayersGunIDs(players) {
	let counter = 0;
	players.forEach(player => {
		player.gunID = counter++;
		player.ws.send(JSON.stringify({ msgType: "assignGunID", GunID: counter }));
	});
}

function allPlayersReady(players) {
	let ready = true;
	players.forEach((player) => {
		if (player.state != undefined) {
			if (player.state != "ready") {
				ready = false;
			}
		}
	});
	return ready;
}

function startGame() {
	if (game.state == "waiting") {
		console.log(`Starting Game (${game.id})`);
		game.state = "starting";
		assignPlayersGunIDs(game.players);
		playerListUpdate(game);
		game.players.forEach(player => {
			player.ws.send(JSON.stringify({ "msgType": "updateGameSettings", "settings": game.settings }));
			player.ws.send(JSON.stringify({ "msgType": "updateWeaponDefinitions", "weapons": weaponDefinitions }));
			player.ws.send(JSON.stringify({
				msgType: "updateGameState",
				state: "starting",
				cooldown: game.settings.preStartCooldown,
			}));
		});

		setTimeout(() => {
			game.state = "started";
			game.players.forEach(player => {
				player.ws.send(JSON.stringify({ msgType: "updateGameState", state: "started" }));
			});
			let currentTime = new Date();
			game.gameEnd = new Date(currentTime.getTime() + (60000 * game.settings.gameTimeMins)); // Korrekte Zeitberechnung
			mainTimer = setTimeout(() => { endGame() }, 60000 * game.settings.gameTimeMins);
		}, game.settings.preStartCooldown);
	} else {
		console.log("Game already started");
	}
}

function endGame() {
	game.players.forEach(player => {
		player.ws.send(JSON.stringify({ msgType: "updateGameState", state: "ended" }));
	});
	console.log(`Game ended (${game.id})`);
	game.state = "waiting";
}

function handleGameMessage(ws, message) {
	// declare player variable
	let player;

	// attempt to set player variable
	try {
		player = ws.game.players.find(player => player.ws.id == ws.id);
	} catch (e) {
		// if an error occurs, log it (optional) and proceed
		console.error("Failed to set player:", e);
	}

	// handle message
	switch (message.msgType) {
		case "getGameEndTime":
			if (game.state == "started") {
				// get remaining battle time
				player.ws.send(ws.id, JSON.stringify({ "msgType": "remainingTime", "time": ws.game.gameEnd }));
			}
			break;
		case "setState":
			if (!player) {
				return;
			}
			player.state = message.state;
			if (ws.game.settings.startOnReady == true) {
				if (allPlayersReady(ws.game.players)) {
					console.log("All players are ready.");
					setTimeout(() => {
						if (allPlayersReady(ws.game.players) && (game.state == "waiting")) {
							startGame();
						}
					}, 2000);
				}
			}
			lobbyUpdate(ws.game.players);
			break;
		case "forceStartGame":
			startGame();
			break;
		case "kill":
			let killer = ws.game.players.find(player => {
				console.log('== Try to match the shooter id with a player ==')
				console.log("player.gunID");
				console.log(player.gunID);

				console.log("message.info.shooterID:");
				console.log(message.info.shooterID);

				return player.gunID == message.info.shooterID;
			});

			try {
				killer.ws.send(killer, JSON.stringify({ "msgType": "kill" }));
			} catch (error) {
				console.log("Failed to set killer");
				console.log("killer:");
				console.log(killer); // wasn't defined
			}
			break;
	}
}

function makeUID(length) {
	var result = "";
	var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

function lobbyUpdate(players) {
	console.log("lobby update");
	let filteredPlayerList = [];
	players.forEach(player => {
		if (player.state == undefined) {
			return;
		}
		let ready = false;
		if (player.state == "ready") {
			ready = true;
		}
		filteredPlayerList.push({
			username: player.username,
			uuid: player.uuid,
			ready: ready,
		});
	});
	players.forEach(player => {
		player.ws.send(JSON.stringify({
			msgType: "lobbyUpdate",
			players: filteredPlayerList,
		}));
	})
}

function playerListUpdate(game) {
	let filteredPlayerList = [];
	let { players } = game;
	players.forEach(player => {
		if (player.state != "ready") {
			return;
		}
		filteredPlayerList.push({
			username: player.username,
			uuid: player.uuid,
			gunID: player.gunID
		});
	});
	players.forEach(player => {
		player.ws.send(JSON.stringify({
			msgType: "playerListUpdate",
			players: filteredPlayerList,
		}));
	});
}
