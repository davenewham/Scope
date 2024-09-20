import WebSocket, { WebSocketServer } from "ws";
import express from "express";
import * as fsp from "fs/promises";
import * as fs from "fs";
import * as https from "https";
import stripJsonComments from "strip-json-comments";
import { inspect } from "util";

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
		const defaultSettingsData = await fsp.readFile("config/game/default.jsonc");
		defaultSettings = JSON.parse(stripJsonComments(defaultSettingsData.toString()));
	} catch (err) {
		console.error(err);
	}

	// Read weapon configs
	try {
		const files = await fsp.readdir("config/weapon");
		for (const file of files) {
			console.log("Found weapon config" + file);
			try {
				const data = await fsp.readFile("config/weapon/" + file, "utf-8");
				weaponDefinitions.push(JSON.parse(stripJsonComments(data.toString())));
			} catch (err) {
				console.log("Failed to read file: ", file, err);
			}
		}
	} catch (err) {
		console.error("Unable to read weapon config directory: " + err);
	}
}

loadConf().then(() => {
	game.settings = defaultSettings;
});
console.log("Game id: " + game.id);

const httpServer = https.createServer(
	{
		key: fs.readFileSync("certs/server.key"),
		cert: fs.readFileSync("certs/server.cert"),
	},
	express()
);

const wss: WebSocketServer = new WebSocket.Server({ server: httpServer });
httpServer.listen(serverPort, () => {
	console.log("Server listening at https://localhost:3000/");
});

function handleJoin(ws: WebSocket & { id?: number; game?: Game; player?: Player }, command: any) {
	if (ws.game) {
		console.log("Player has already joined game");
		return;
	}
	if (game.state !== "waiting") {
		console.log("Join rejected: Game already in progress");
		ws.send(JSON.stringify({ msgType: "gameAlreadyStarted" }));
		return;
	} else {
		const player: Player = {
			username: undefined,
			ws: ws,
			uuid: makeUID(10),
		};
		game.players.push(player);
		ws.game = game;
		ws.player = player;
		console.log(`ws now should have a game: ${inspect(ws.game)}`);
		console.log(`as well as a player: ${inspect(ws.player)}`);
	}
}

wss.on("connection", (ws: WebSocket) => {
	ws.id = socketCounter += 1; // Label this socket
	console.log("Websocket Connection | WSID:", ws.id);

	ws.on("message", (message: string) => {
		const command = JSON.parse(message);
		console.log(command);
		switch (command.msgType) {
			case "join":
				handleJoin(ws, command);
				break;
			case "reconnect":
				console.log(`Player with UUID ${command.uuid} is trying to reconnect...`);
				console.log(`In Reconnect the ws should have a game: ${inspect(ws.game)}`);
				console.log(`As well as a players list within game: ${inspect(ws.game.players)}`);

				if (ws.game) {
					console.log("Player is already connected");
					break;
				}
				const playerdata = ws.game.players.find((player) => {
					return player.uuid == command.uuid;
				});
				if (!playerdata) {
					console.log(`Could not find player uuid to reconnect: ${command.uuid}`);
					break;
				}

				console.log(`User has successfully reconnected!`);
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
		// update missing players if the connection had a ws.game
		// only exists for players that were in game, not for players who joined later
		if (ws.game) {
			let missingPlayerIndex = ws.game.players.findIndex((player) => {
				return player.ws.id == ws.id;
			});
			if (missingPlayerIndex == -1) {
				console.log("could not find player to remove");
				return;
			}
			console.log(`${ws.game.players[missingPlayerIndex].username || "Player"} Disconnected`);
			if (game.state == "waiting") {
				ws.game.players.splice(missingPlayerIndex, 1);
				lobbyUpdate(ws.game.players);
			}
		}
	});
});

function assignPlayersGunIDs(players) {
	let counter = 1; // Do not give anyone 0!
	players.forEach((player) => {
		player.ws.send(JSON.stringify({ msgType: "assignGunID", GunID: counter }));
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
		game.players.forEach((player) => {
			player.ws.send(JSON.stringify({ msgType: "updateGameSettings", settings: game.settings }));
			player.ws.send(JSON.stringify({ msgType: "updateWeaponDefinitions", weapons: weaponDefinitions }));
			player.ws.send(
				JSON.stringify({
					msgType: "updateGameState",
					state: "starting",
					cooldown: game.settings!.preStartCooldown,
				})
			);
		});

		setTimeout(() => {
			game.state = "started";
			game.players.forEach((player) => {
				player.ws.send(JSON.stringify({ msgType: "updateGameState", state: "started" }));
			});
			const currentTime = new Date();
			game.gameEnd = new Date(currentTime.getTime() + 60000 * game.settings!.gameTimeMins); // Korrekte Zeitberechnung
			game.timer = setTimeout(() => {
				endGame();
			}, 60000 * game.settings!.gameTimeMins);
		}, game.settings!.preStartCooldown);
	} else {
		console.log("Game already started");
	}
}

function endGame() {
	game.players.forEach((player) => {
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
		player = ws.game.players.find((player) => player.ws.id == ws.id);
	} catch (e) {
		// if an error occurs, log it (optional) and proceed
		console.error("Failed to set player:", e);
	}

	// handle message
	switch (message.msgType) {
		case "getGameEndTime":
			if (game.state == "started") {
				// get remaining battle time
				player.ws.send(ws.id, JSON.stringify({ msgType: "remainingTime", time: ws.game.gameEnd }));
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
						if (allPlayersReady(ws.game.players) && game.state == "waiting") {
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
			/*
			message.info includes attributes: shooterID, shooterName, killedName, weapon, time
			 */
			let killer = ws.game.players.find((player) => {
				console.log("== Try to match the shooter id with a player ==");
				console.log(`player.username: ${player.username}`);
				console.log(`message.info.shooterName: ${message.info.shooterName}`);

				return player.username == message.info.shooterName;
			});

			try {
				let killmsg = {
					msgType: "kill",
					killed: message.info.killedName,
					weapon: message.info.weaponID,
				};
				killer.ws.send(JSON.stringify(killmsg));
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
		.filter((player) => player.state !== undefined)
		.map((player) => ({
			username: player.username,
			uuid: player.uuid,
			ready: player.state === "ready",
		}));

	players.forEach((player) => {
		player.ws.send(
			JSON.stringify({
				msgType: "lobbyUpdate",
				players: filteredPlayerList,
			})
		);
	});
}

function playerListUpdate(game: Game) {
	const filteredPlayerList = game.players
		.filter((player) => player.state === "ready")
		.map((player) => ({
			username: player.username,
			uuid: player.uuid,
			gunID: player.gunID,
		}));
	game.players.forEach((player) => {
		player.ws.send(
			JSON.stringify({
				msgType: "playerListUpdate",
				players: filteredPlayerList,
			})
		);
	});
}
