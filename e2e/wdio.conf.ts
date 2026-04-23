import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("./", import.meta.url));
const projectRoot = resolve(here, "..");

const tauriTarget = process.platform === "win32" ? "markdown-viewer.exe" : "markdown-viewer";
const application = resolve(projectRoot, "src-tauri", "target", "debug", tauriTarget);
const sampleFile = resolve(projectRoot, "test", "sample.md");

if (!existsSync(application)) {
  throw new Error(
    `tauri binary not found at ${application}. Run 'npm run tauri build -- --debug --no-bundle' first.`,
  );
}

function locateNativeDriver(): string {
  if (process.env.TAURI_NATIVE_DRIVER) return process.env.TAURI_NATIVE_DRIVER;
  const candidates =
    process.platform === "linux"
      ? ["/usr/bin/WebKitWebDriver", "/usr/lib/webkit2gtk-4.1/WebKitWebDriver"]
      : [];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fall back to `which` for Linux installations via package manager.
  if (process.platform === "linux") {
    const out = spawnSync("which", ["WebKitWebDriver"]);
    const found = out.stdout.toString().trim();
    if (found) return found;
  }
  throw new Error(
    "native webdriver not found. Install webkit2gtk-driver (Linux) or set TAURI_NATIVE_DRIVER.",
  );
}

let tauriDriverProcess: ChildProcess | null = null;

export const config: WebdriverIO.Config = {
  runner: "local",
  hostname: "127.0.0.1",
  port: 4444,
  specs: [resolve(here, "specs", "**/*.spec.ts")],
  exclude: [],
  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application,
        args: [sampleFile],
      },
    } as WebdriverIO.Capabilities,
  ],

  logLevel: "warn",
  bail: 0,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 60_000,
  connectionRetryCount: 3,

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },
  reporters: ["spec"],

  onPrepare: () => {
    const driver = locateNativeDriver();
    tauriDriverProcess = spawn("tauri-driver", ["--native-driver", driver, "--port", "4444"], {
      stdio: "inherit",
    });
    // small warm-up delay so the driver binds to the port before WDIO connects
    return new Promise((r) => setTimeout(r, 1_500));
  },

  onComplete: () => {
    if (tauriDriverProcess) {
      tauriDriverProcess.kill("SIGTERM");
      tauriDriverProcess = null;
    }
  },
};
