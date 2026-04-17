/**
 * kill-ports.js
 * Mata los procesos que ocupan los puertos de desarrollo antes de arrancar.
 * Compatible con Windows (usa netstat + taskkill).
 */

const { execSync } = require("child_process");

const PORTS = [5101, 5173, 5174, 5175, 5176];

for (const port of PORTS) {
  try {
    // Obtener PIDs que escuchan en el puerto
    const result = execSync(
      `netstat -ano | findstr /R /C:":${port} "`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
    );

    const pids = new Set();
    for (const line of result.split("\n")) {
      if (!line.includes("LISTENING") && !line.includes("ESTABLISHED")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`[kill-ports] Puerto ${port} liberado (PID ${pid})`);
      } catch {
        // proceso ya terminado
      }
    }
  } catch {
    // puerto libre, nada que matar
  }
}
