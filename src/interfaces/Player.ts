import { Socket} from "socket.io";

export interface Player {
    username: string | undefined;
    socket: Socket;
    uuid: string;
    state?: string;
    gunID?: number;
    kills: number;
}