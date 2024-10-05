import { Server } from "socket.io";
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

const httpsServer = https.createServer(
	{
		key: fs.readFileSync("certs/server.key"),
		cert: fs.readFileSync("certs/server.cert"),
	},
);

const io = new Server(httpsServer, {
	connectionStateRecovery: {
	  maxDisconnectionDuration: 2 * 60 * 1000,
	  skipMiddlewares: true,
	}
  });

httpsServer.listen(serverPort, () => {
	console.log(`Server listening at https://localhost:${serverPort}/`);
});
io.on("connection", (socket: any & { id?: number; game?: Game; player?: Player }) => {
	console.log("Websocket Connection | socketID:", socket.id);

	socket.on("join", (data) => {
		if (socket.game) {
			console.log("Player has already joined game");
			return;
		}
		if (socket.state !== "waiting") {
			console.log("Join rejected: Game already in progress");
			socket.emit("gameAlreadyStarted");
			return;
		} else {
			const player: Player = {
				username: undefined,
				socket: socket,
				uuid: socket.id,
			};
			game.players.push(player);
			socket.game = game;
			socket.player = player;
			// console.log(`socket now should have a game: ${inspect(socket.game)}`);
			// console.log(`as well as a player: ${inspect(socket.player)}`);
		}
	});

	socket.on("reconnect", (data) => {
		const { uuid } = data;
		console.log(`Player with UUID ${uuid} is trying to reconnect...`);
		console.log(`In Reconnect the socket should have a game: ${inspect(socket.game)}`);
		console.log(`As well as a players list within game: ${inspect(socket.game.players)}`);

		if (socket.game) {
			console.log("Player is already connected");
			return;
		}
		const playerdata = socket.game?.players.find((player) => player.uuid === uuid);

		if (!playerdata) {
			console.log(`Could not find player uuid to reconnect: ${uuid}`);
			return;
		}

		console.log(`User has successfully reconnected!`);
		playerdata.socket = socket;
		socket.game = game;
	})

	socket.on("updateGameSettings", (settings) => {
		game.settings = settings;
	})

	socket.on("updateWeaponDefinitions", (weaponDefinitions) => {
		weaponDefinitions = weaponDefinitions;
	})

	socket.on("setUsername", ({username}) => {
		socket.player.username = username;
		//console.log(socket.player.username)
		//console.log(socket.game.players)
		lobbyUpdate(socket.game.players);
	})

	socket.on("getGameEndTime", () => {
		if (game?.state === "started") {
		  socket.emit("remainingTime", { time: socket.game.gameEnd });
		}
	  });

	socket.on("setState", ({state}) => {
		const player = socket.game?.players.find((p) => p.socket.id === socket.id)
		if (!player){
			console.error("Player not found for socket?", socket.id)
			return;
		}

		player.state = state;

		if (allPlayersReady(socket.game.players)) {
			console.log("All players are ready.");
			setTimeout(() => {
				if (allPlayersReady(socket.game.players) && game.state == "waiting") {
					startGame();
				}
			}, 2000);
		}

		lobbyUpdate(socket.game.players);
	});

	socket.on("forceStartGame", () => {
		startGame();
	})

	socket.on("kill", ({info}) => {
		console.log(info)
		const killer = socket.game.players.find(player => player.username == info.shooterName);

		if (!killer) {
			console.error(`Shooter not found! ${info.shooterName}`);
			return;
		}

		try {
			killer.socket.emit("kill", { killed: info.killedName, weapon: info.weapon });
		} catch (error) {
			console.log(`Failed to set killer due to ${error}`);
			console.log(`killer: ${killer}`);
		}
	})

	socket.on("close", () => {
		// update missing players if the connection had a socket.game
		// only exists for players that were in game, not for players who joined later
		if (socket.game) {
			let missingPlayerIndex = socket.game.players.findIndex((player) => {
				return player.socket.id == socket.id;
			});
			if (missingPlayerIndex == -1) {
				console.log("could not find player to remove");
				return;
			}
			console.log(`${socket.game.players[missingPlayerIndex].username || "Player"} Disconnected`);
			if (game.state == "waiting") {
				socket.game.players.splice(missingPlayerIndex, 1);
				lobbyUpdate(socket.game.players);
			}
		}
	});
});

function assignPlayersGunIDs(players) {
	let counter = 1; // Do not give anyone 0!
	players.forEach((player) => {
		player.socket.emit("assignGunID", { GunID: counter });
		player.gunID = counter++;
	});
}

function allPlayersReady(players) {
	return players.every((player) => player.state === "ready");
}

function startGame() {
	if (game.state == "waiting") {
		console.log(`Starting Game (${game.id})`);
		game.state = "starting";
		assignPlayersGunIDs(game.players);
		playerListUpdate(game);
		io.emit("updateGameSettings", { settings: game.settings });
		io.emit("updateWeaponDefinitions", { weapons: weaponDefinitions });
		io.emit("updateGameState", {
			state: "starting",
			cooldown: game.settings!.preStartCooldown,
		});

		setTimeout(() => {
			game.state = "started";
			io.emit("updateGameState", {state: "started"});

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
	io.emit("updateGameState", { state: "ended" });
	console.log(`Game ended (${game.id})`);
	game.state = "waiting";
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

function lobbyUpdate(players: Player[] = []) {
    console.log("lobby update");

    const filteredPlayerList = players
        .filter((player) => player?.username !== undefined)
        .map((player) => ({
            username: player.username,
            uuid: player.uuid,
            ready: player.state === "ready",
        }));

		io.emit("lobbyUpdate", { players: filteredPlayerList });
};

function playerListUpdate(game: Game) {
	const filteredPlayerList = game.players
		.filter((player) => player.state === "ready")
		.map((player) => ({
			username: player.username,
			uuid: player.uuid,
			gunID: player.gunID,
		}));
	io.emit("playerListUpdate",  { players: filteredPlayerList });
}
