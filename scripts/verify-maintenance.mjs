import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
}

const files = ["src/layouts/PortalLayout.jsx", "src/pages/LandingPage.jsx", "src/pages/RequestAccess.jsx", "README.md", "MAINTAINER_GUARDRAILS.md"];
for (const file of files) {
  if ((await readFile(file, "utf8")).includes("Integrated Operations System")) throw new Error(`Stale ORAC-IOS name in ${file}`);
}
run("npm", ["test"]);
run("npm", ["run", "build"]);
run("git", ["diff", "--check"]);
console.log("ORAC-IOS frontend maintenance gate passed.");
