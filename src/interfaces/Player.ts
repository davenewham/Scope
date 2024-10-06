import { Socket} from "socket.io";
import { Stats } from "./Stats";

export interface Player {
    username: string | undefined;
    socket: Socket;
    uuid: string;
    state?: string;
    gunID?: number;
    stats: Stats
}