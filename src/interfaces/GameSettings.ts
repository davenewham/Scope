export interface GameSettings {
    startOnReady: boolean;
    gameTimeMins: number;
    preStartCooldown: number;
    defaultWeapon: string;
    startAmmo: string;
    telemetry: boolean;
    dropAmmoOnReload: boolean;
}