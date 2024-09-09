export interface WeaponBehaviour {
    /**
     * 
     */
    triggerMode: number;
    /**
     * 
     */
    rateOfFire: number;
    /**
     *  0 to 254
     */
    muzzleFlashMode: number; 
    /**
     * 
     */
    flashParam1: number;
    /**
     * 
     */
    flashParam2: number;
    /**
     * 0 to 255
     */
    narrowIrPower: number;
    /**
     * 0 to 255
     */
    wideIrPower: number;
    /**
    * 0 to 255
    */
    muzzleLedPower: number;
    /**
    * 
    */
    motorPower: number;
}