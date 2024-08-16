import { Player } from "./Player";
import { GameSettings } from "./GameSettings";

export interface Game {
    id: string;
    state: string;
    players: Player[];
    timer: any;
    gameEnd: Date | null;
    settings: GameSettings | null;
}