// Launches the Python recommendation service from `npm run service`.
//
// A plain npm script cannot do this portably: the virtual environment puts
// Python in .venv/Scripts on Windows and .venv/bin everywhere else, and cmd.exe
// mishandles forward slashes in an executable path. This picks the right one and
// says something useful when the environment has not been created yet.

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const SERVICE_DIR = path.join(__dirname, "..", "service");
const isWindows = process.platform === "win32";

const python = path.join(
  SERVICE_DIR,
  ".venv",
  isWindows ? "Scripts" : "bin",
  isWindows ? "python.exe" : "python"
);

if (!fs.existsSync(python)) {
  console.error("\nNo virtual environment found at service/.venv\n");
  console.error("Create it once, from the service folder:\n");
  console.error("  cd service");
  console.error(isWindows ? "  python -m venv .venv" : "  python3 -m venv .venv");
  console.error(isWindows ? "  .venv\\Scripts\\python.exe -m pip install -r requirements.txt" : "  .venv/bin/python -m pip install -r requirements.txt");
  console.error("");
  process.exit(1);
}

// --host 0.0.0.0 is not optional: the default binds to localhost only, and the
// phone is a different machine.
//
// --reload-dir is needed because npm runs this from the project root, so the
// reloader would otherwise watch the whole React Native app and restart Python
// every time a .tsx file is saved.
const args = [
  "-m",
  "uvicorn",
  "main:app",
  "--app-dir",
  SERVICE_DIR,
  "--host",
  "0.0.0.0",
  "--port",
  "8000",
  "--reload",
  "--reload-dir",
  SERVICE_DIR,
];

const child = spawn(python, args, { stdio: "inherit" });

child.on("error", (error) => {
  console.error(`Could not start the service: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  // Ctrl+C arrives as a signal, not an exit code — that is a normal stop.
  process.exit(signal ? 0 : code ?? 0);
});
