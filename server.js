"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = require("ws");
var express_1 = require("express");
var fsp = require("fs/promises");
var fs = require("fs");
var https_1 = require("https");
var strip_json_comments_1 = require("strip-json-comments");
var colors_1 = require("@colors/colors");
var serverPort = 3000;
var defaultSettings;
var weaponDefinitions = [];
var socketCounter = 0;
var game = {
    id: makeUID(6),
    state: "waiting",
    players: [],
    timer: null,
    gameEnd: null,
    settings: null,
};
function loadConf() {
    return __awaiter(this, void 0, void 0, function () {
        var defaultSettingsData, err_1, files, _i, files_1, file, data, err_2, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fsp.readFile("config/game/default.jsonc")];
                case 1:
                    defaultSettingsData = _a.sent();
                    defaultSettings = JSON.parse((0, strip_json_comments_1.default)(defaultSettingsData.toString()));
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    console.error(err_1);
                    return [3 /*break*/, 3];
                case 3:
                    _a.trys.push([3, 11, , 12]);
                    return [4 /*yield*/, fsp.readdir('config/weapon')];
                case 4:
                    files = _a.sent();
                    _i = 0, files_1 = files;
                    _a.label = 5;
                case 5:
                    if (!(_i < files_1.length)) return [3 /*break*/, 10];
                    file = files_1[_i];
                    console.log(colors_1.default.yellow("Found weapon config" + file));
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, fsp.readFile('config/weapon/' + file, "utf-8")];
                case 7:
                    data = _a.sent();
                    weaponDefinitions.push(JSON.parse((0, strip_json_comments_1.default)(data.toString())));
                    return [3 /*break*/, 9];
                case 8:
                    err_2 = _a.sent();
                    console.log("Failed to read file: ", file, err_2);
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 5];
                case 10: return [3 /*break*/, 12];
                case 11:
                    err_3 = _a.sent();
                    console.error('Unable to read weapon config directory: ' + err_3);
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/];
            }
        });
    });
}
loadConf().then(function () {
    game.settings = defaultSettings;
});
console.log(("Game id: " + game.id).green);
var httpServer = https_1.default.createServer({
    key: fs.readFileSync("certs/server.key"),
    cert: fs.readFileSync("certs/server.cert"),
}, (0, express_1.default)());
var wss = new ws_1.default.Server({ server: httpServer });
httpServer.listen(serverPort, function () {
    console.log("Server listening at https://localhost:3000/".yellow);
});
function handleJoin(ws, command) {
    if (game.state !== "waiting") {
        console.log("Join rejected: Game already in progress");
        ws.send(JSON.stringify({ msgType: "gameAlreadyStarted" }));
        return;
    }
    if (ws.game) {
        console.log("Player has already joined game");
        return;
    }
    var player = {
        username: undefined,
        ws: ws,
        uuid: makeUID(10),
    };
    game.players.push(player);
    ws.game = game;
    ws.player = player;
}
wss.on("connection", function (ws) {
    ws.id = socketCounter += 1; // Label this socket
    console.log("Websocket Connection | WSID:", ws.id);
    ws.on("message", function (message) {
        var command = JSON.parse(message);
        console.log(command);
        switch (command.msgType) {
            case "join":
                handleJoin(ws, command);
            case "reconnect":
                if (ws.game) {
                    console.log("Player is already connected");
                    break;
                }
                var playerdata = ws.game.players.find(function (player) {
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
    ws.on("close", function () {
        var missingPlayerIndex = ws.game.players.findIndex(function (player) { return player.ws.id == ws.id; });
        if (missingPlayerIndex == -1) {
            console.log("could not find player to remove");
            return;
        }
        console.log("".concat(ws.game.players[missingPlayerIndex].username || "Player", " Disconnected"));
        if (game.state == "waiting") {
            ws.game.players.splice(missingPlayerIndex, 1);
            lobbyUpdate(ws.game.players);
        }
    });
});
function assignPlayersGunIDs(players) {
    var counter = 0;
    players.forEach(function (player) {
        player.gunID = counter++;
        player.ws.send(JSON.stringify({ msgType: "assignGunID", GunID: counter }));
    });
}
function allPlayersReady(players) {
    var ready = true;
    players.forEach(function (player) {
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
        console.log("Starting Game (".concat(game.id, ")"));
        game.state = "starting";
        assignPlayersGunIDs(game.players);
        playerListUpdate(game);
        game.players.forEach(function (player) {
            player.ws.send(JSON.stringify({ "msgType": "updateGameSettings", "settings": game.settings }));
            player.ws.send(JSON.stringify({ "msgType": "updateWeaponDefinitions", "weapons": weaponDefinitions }));
            player.ws.send(JSON.stringify({
                msgType: "updateGameState",
                state: "starting",
                cooldown: game.settings.preStartCooldown,
            }));
        });
        setTimeout(function () {
            game.state = "started";
            game.players.forEach(function (player) {
                player.ws.send(JSON.stringify({ msgType: "updateGameState", state: "started" }));
            });
            var currentTime = new Date();
            game.gameEnd = new Date(currentTime.getTime() + (60000 * game.settings.gameTimeMins)); // Korrekte Zeitberechnung
            game.timer(setTimeout(function () { endGame(); }, 60000 * game.settings.gameTimeMins));
        }, game.settings.preStartCooldown);
    }
    else {
        console.log("Game already started");
    }
}
function endGame() {
    game.players.forEach(function (player) {
        player.ws.send(JSON.stringify({ msgType: "updateGameState", state: "ended" }));
    });
    console.log("Game ended (".concat(game.id, ")"));
    game.state = "waiting";
}
function handleGameMessage(ws, message) {
    // declare player variable
    var player;
    // attempt to set player variable
    try {
        player = ws.game.players.find(function (player) { return player.ws.id == ws.id; });
    }
    catch (e) {
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
                    setTimeout(function () {
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
            var killer = ws.game.players.find(function (player) {
                console.log('== Try to match the shooter id with a player ==');
                console.log("player.gunID");
                console.log(player.gunID);
                console.log("message.info.shooterID:");
                console.log(message.info.shooterID);
                return player.gunID == message.info.shooterID;
            });
            try {
                killer.ws.send(killer, JSON.stringify({ "msgType": "kill" }));
            }
            catch (error) {
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
    var filteredPlayerList = players
        .filter(function (player) { return player.state !== undefined; })
        .map(function (player) { return ({
        username: player.username,
        uuid: player.uuid,
        ready: player.state === "ready",
    }); });
    players.forEach(function (player) {
        player.ws.send(JSON.stringify({
            msgType: "lobbyUpdate",
            players: filteredPlayerList,
        }));
    });
}
function playerListUpdate(game) {
    var filteredPlayerList = game.players
        .filter(function (player) { return player.state === "ready"; })
        .map(function (player) { return ({
        username: player.username,
        uuid: player.uuid,
        gunID: player.gunID,
    }); });
    game.players.forEach(function (player) {
        player.ws.send(JSON.stringify({
            msgType: "playerListUpdate",
            players: filteredPlayerList,
        }));
    });
}
