import { TelemetryButtons } from "./TelemetryButton";
import { ButtonCount } from "./ButtonCount";
import { IrEvent } from "./IrEvent";

export interface Telemetry {
    buttons: TelemetryButtons;
    buttonCount: ButtonCount;
    batteryVoltage: number;
    ammo: number;
    flags: number;
    weaponType: number;
    IrEvent1: IrEvent;
    IrEvent2: IrEvent;
}