import { WeaponBehaviour } from "./WeaponBehaviour";

export interface WeaponDefinition {
    name: string;
    description: string;
    slotID: number;
    damage: number;
    maxLoadedAmmo: number;
    maxClips: number;
    behaviour: WeaponBehaviour;
}