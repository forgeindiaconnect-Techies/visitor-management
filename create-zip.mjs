import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const root = process.cwd();
const temp = path.join(root, "temp_bundle");
const zip = path.join(root, "zone-monitor-source.zip");

const excluded = new Set([
  "node_modules",
  ".env",
  ".env.local",
  "dist",
  "dev-dist"
]);

const filter = (source) => {
  return !excluded.has(path.basename(source));
};

try {
  fs.rmSync(temp, { recursive: true, force: true });
  fs.rmSync(zip, { force: true });
  fs.mkdirSync(temp);

  fs.cpSync(
    path.join(root, "server"),
    path.join(temp, "server"),
    { recursive: true, filter }
  );

  fs.cpSync(
    path.join(root, "src"),
    path.join(temp, "src"),
    { recursive: true, filter }
  );

  fs.copyFileSync(
    path.join(root, "package.json"),
    path.join(temp, "package.json")
  );

  execFileSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${temp}\\*' -DestinationPath '${zip}' -Force`
  ]);

  console.log("ZIP created successfully:");
  console.log(zip);
} catch (error) {
  console.error("ZIP creation failed:", error.message);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}