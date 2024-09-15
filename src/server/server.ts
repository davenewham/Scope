import { Server } from "socket.io";
import express from "express";
import * as fsp from "fs/promises";
import * as fs from "fs";
import * as https from "https";
import stripJsonComments from "strip-json-comments";

import { WeaponDefinition } from "../interfaces/WeaponDefinition";
import { Game } from "../interfaces/Game";
import { Player } from "../interfaces/Player";

const serverPort = 3000;
let defaultSettings;

let weaponDefinitions: WeaponDefinition[] = [];
let socketCounter = 0;


let game: Game = {
	id: makeUID(6),
	state: "waiting",
	players: [],
	timer: null,
	gameEnd: null,
	settings: null,
};

async function loadConf() {
	// load game config
	try {
		const defaultSettingsData = await fsp.readFile("config/game/default.jsonc")
		defaultSettings = JSON.parse(stripJsonComments(defaultSettingsData.toString()));
	} catch (err) {
		console.error(err);
	}

	// Read weapon configs
	try {
		const files = await fsp.readdir('config/weapon');
		for (const file of files) {
			console.log(("Found weapon config" + file));
			try {
				const data = await fsp.readFile('config/weapon/' + file, "utf-8")
				weaponDefinitions.push(JSON.parse(stripJsonComments(data.toString())));
			} catch (err) {
				console.log("Failed to read file: ", file, err);
			}
		}

	} catch (err) {
		console.error('Unable to read weapon config directory: ' + err);
	}
}

loadConf().then(() => {
	game.settings = defaultSettings;
});
console.log(("Game id: " + game.id));

const httpsServer = https.createServer(
	{
		key: fs.readFileSync("certs/server.key"),
		cert: fs.readFileSync("certs/server.cert"),
	},
	express()
);

const io = new Server(httpsServer);

httpsServer.listen(serverPort, () => {
	console.log("Server listening at https://localhost:3000/");
});

function handleJoin(socket: any & { id?: number; game?: Game; player?: Player }, command: any) {
	if (game.state !== "waiting") {
		console.log("Join rejected: Game already in progress");
		socket.emit({ msgType: "gameAlreadyStarted" });
		return;
	}
	if (socket.game) {
		console.log("Player has already joined game");
		return;
	}
	const player: Player = {
		username: undefined,
		socket: socket,
		uuid: makeUID(10),
	};
	game.players.push(player);
	socket.game = game;
	socket.player = player;
}


io.on("connection", (socket: any & { id?: number; game?: Game; player?: Player }) => {
	console.log("Websocket Connection | WSID:", socket.id);

	socket.on("message", (message) => {
		const command = JSON.parse(message);
		console.log(command);
		switch (command.msgType) {
			case "join":
				handleJoin(socket, command);
				break;
			case "reconnect":
				if (socket.game) {
					console.log("Player is already connected");
					break;
				}
				const playerdata = socket.game.players.find(player => {
					return player.uuid == command.uuid;
				});
				if (!playerdata) {
					console.log("Could not find player uuid to reconnect");
					break;
				}
				playerdata.socket = socket;
				socket.game = game;
				break;
			case "updateGameSettings":
				game.settings = command.settings;
				break;

			case "updateWeaponDefinitions":
				weaponDefinitions = command.weaponDefinitions;
				break;

			case "setUsername":
				socket.player.username = command.username;
				lobbyUpdate(socket.game.players);
				break;

			default:
				if (game) {
					handleGameMessage(socket, command);
				}
				break;
		}
	});
	socket.on("disconnect", () => {
		let missingPlayerIndex = game.players.findIndex(player => player.socket.id === socket.id);
		if (missingPlayerIndex == -1) {
			console.log("could not find player to remove");
			return;
		}
		console.log(`${game.players[missingPlayerIndex].username || "Player"} Disconnected`);
		if (game.state == "waiting") {
			game.players.splice(missingPlayerIndex, 1);
			lobbyUpdate(game.players);
		}
	});
});

function assignPlayersGunIDs(players) {
	let counter = 1; // Do not give anyone 0!
	players.forEach(player => {
		player.socket.emit({ msgType: "assignGunID", GunID: counter });
		player.gunID = counter++;
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
			player.socket.emit(JSON.stringify({ "msgType": "updateGameSettings", "settings": game.settings }));
			player.socket.emit(JSON.stringify({ "msgType": "updateWeaponDefinitions", "weapons": weaponDefinitions }));
			player.socket.emit(JSON.stringify({
				msgType: "updateGameState",
				state: "starting",
				cooldown: game.settings!.preStartCooldown,
			}));
		});

		setTimeout(() => {
			game.state = "started";
			io.emit("updateGameState", {state: "started"});
			const currentTime = new Date();
			game.gameEnd = new Date(currentTime.getTime() + (60000 * game.settings!.gameTimeMins)); // Korrekte Zeitberechnung
			game.timer = setTimeout(() => { endGame() }, 60000 * game.settings!.gameTimeMins);
		}, game.settings!.preStartCooldown);
	} else {
		console.log("Game already started");
	}
}

function endGame() {
	io.emit("updateGameState", { state: "ended"});
	console.log(`Game ended (${game.id})`);
	game.state = "waiting";
}

function handleGameMessage(socket, message) {
	// declare player variable
	let player;

	// attempt to set player variable
	try {
		player = socket.game.players.find(player => player.socket.id == socket.id);
	} catch (e) {
		// if an error occurs, log it (optional) and proceed
		console.error("Failed to set player:", e);
	}

	// handle message
	switch (message.msgType) {
		case "getGameEndTime":
			if (game.state == "started") {
				// get remaining battle time
				player.socket.emit("remainingTime", {"time": socket.game.gameEnd });
			}
			break;
		case "setState":
			if (!player) {
				return;
			}
			player.state = message.state;
			if (socket.game.settings.startOnReady) {
				if (allPlayersReady(socket.game.players)) {
					console.log("All players are ready.");
					setTimeout(() => {
						if (allPlayersReady(socket.game.players) && (game.state == "waiting")) {
							startGame();
						}
					}, 2000);
				}
			}
			lobbyUpdate(socket.game.players);
			break;
		case "forceStartGame":
			startGame();
			break;
		case "kill":
			/*
			message.info includes attributes: shooterID, shooterName, killedName, weapon, time
			 */
			let killer = socket.game.players.find(player => {
				console.log('== Try to match the shooter id with a player ==')
				console.log(`player.username: ${player.username}`);
				console.log(`message.info.shooterName: ${message.info.shooterName}`)

				return player.username == message.info.shooterName;
			});

			try {
				killer.socket.emit("kill", {killed: message.info.killedName,
					weapon: message.info.weaponID});
			} catch (error) {
				console.log(`Failed to set killer due to ${error}`);
				console.log(`killer: ${killer}`);
			}
			break;
	}
}

function makeUID(length) {
	let result = "";
	let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

function lobbyUpdate(players: Player[]) {
	console.log("lobby update");
	const filteredPlayerList = players
		.filter(player => player.state !== undefined)
		.map(player => ({
			username: player.username,
			uuid: player.uuid,
			ready: player.state === "ready",
		}));
	io.emit("lobbyUpdate", {players: filteredPlayerList})
}

function playerListUpdate(game: Game) {
	const filteredPlayerList = game.players
		.filter(player => player.state === "ready")
		.map(player => ({
			username: player.username,
			uuid: player.uuid,
			gunID: player.gunID,
		}));
	io.emit("playerListUpdate", {players: filteredPlayerList});
}
