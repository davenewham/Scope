export interface IrEvent {
    rawPayload: number;
    sensor: number;
    shooterID: number;
    weaponID: number;
    plasmaRounds: number;
    shotCount: number;
    eventCount: number;
    exists: boolean;
}