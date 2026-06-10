// Hook Stop: avisa si hay commits locales sin pushear (sync entre las 2 PCs).
const { execSync } = require("child_process");
try {
  const ahead = parseInt(
    execSync("git rev-list --count @{u}..HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim(),
    10,
  );
  if (ahead > 0) {
    console.log(
      JSON.stringify({
        systemMessage: `⬆️ ${ahead} commit(s) sin pushear a origin — haz 'git push' antes de cambiar de PC.`,
      }),
    );
  }
} catch {
  // sin upstream o fuera de repo: silencio
}
process.exit(0);
