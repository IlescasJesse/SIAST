// Hook PostToolUse(Write|Edit): formatea el archivo editado con Prettier.
// Multiplataforma (Windows/Mac) — recibe JSON del harness por stdin.
let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const file = input.tool_input?.file_path || input.tool_response?.filePath;
    if (file && /\.(ts|tsx|js|jsx|json|css|md)$/.test(file) && !/node_modules/.test(file)) {
      require("child_process").execSync(`npx prettier --write "${file}" --ignore-unknown`, {
        stdio: "ignore",
        timeout: 20000,
      });
    }
  } catch {
    // nunca bloquear la edición por fallo del formateador
  }
  process.exit(0);
});
