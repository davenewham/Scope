export interface Player {
    username: string | undefined;
    ws: WebSocket;
    uuid: string;
    state?: string;
    gunID?: number;
}