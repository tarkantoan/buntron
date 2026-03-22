// ============================================================
// Buntron - Power Monitor Module
// ============================================================

import { EventEmitter } from "events";
import { Kernel32 } from "../native/kernel32";

class PowerMonitorModule extends EventEmitter {
  private pollingInterval: Timer | null = null;
  private lastACStatus: number = -1;

  /**
   * Start monitoring power state changes
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(() => {
      this.checkPowerState();
    }, intervalMs);

    // Initial check
    this.checkPowerState();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Get current power state
   */
  getSystemPowerState(): {
    onBattery: boolean;
    batteryPercent: number;
    isCharging: boolean;
    batteryLifeTime: number;
  } {
    const status = Kernel32.getSystemPowerStatus();
    return {
      onBattery: status.acLineStatus === 0,
      batteryPercent: status.batteryLifePercent,
      isCharging: status.acLineStatus === 1,
      batteryLifeTime: status.batteryLifeTime,
    };
  }

  /**
   * Check if on battery power
   */
  isOnBatteryPower(): boolean {
    return this.getSystemPowerState().onBattery;
  }

  private checkPowerState(): void {
    const status = Kernel32.getSystemPowerStatus();

    if (this.lastACStatus !== -1 && this.lastACStatus !== status.acLineStatus) {
      if (status.acLineStatus === 0) {
        this.emit("on-battery");
      } else {
        this.emit("on-ac");
      }
    }

    this.lastACStatus = status.acLineStatus;
  }
}

export const powerMonitor = new PowerMonitorModule();
export default powerMonitor;
