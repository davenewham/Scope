import { io } from "socket.io-client";
import {lobbyUpdated, preGameStart} from "../../client/game.js"

let socket = null;

export const getSocket = () => {
  initializeSocket();
  return socket; 
};

const initializeSocket = () => {
  if (!socket) {
    console.log("INIT")
    socket = io("wss://" + window.location.host, {});

    socket.on("connect", () => {
      console.log("connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("disconnected:", socket.id);
    });


    socket.on('lobbyUpdate', (message) => {
      lobbyUpdated(message.players);
    });

    socket.on('updateGameState', (message) => {
      if (message.state === "starting") {
        preGameStart(message.cooldown);
      }
    });

    socket.on('updateGameSettings', (message) => {
      gameSettings = message.settings;
    });

    socket.on('assignGunID', (message) => {
      playerGameData.gunID = message.GunID;
    });

    socket.on('updateWeaponDefinitions', (message) => {
      weaponDefinitions = message.weapons;
    });

    socket.on('playerListUpdate', (message) => {
      playerList = message.players;
    });

    socket.on('kill', () => {
      enemyKilled();
    });
  }
};