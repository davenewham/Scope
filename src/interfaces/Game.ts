import { Player } from "./Player";
import { GameSettings } from "./GameSettings";
import { State } from "./State";

export interface Game {
    id: string;
    state: State;
    players: Player[];
    timer: any;
    gameEnd: Date | null;
    settings: GameSettings | null;
}