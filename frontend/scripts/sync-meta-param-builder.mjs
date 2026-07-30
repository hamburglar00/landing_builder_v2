import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_VERSION = "1.3.1";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "..");
const packageDirectory = path.join(
  frontendDirectory,
  "node_modules",
  "meta-capi-param-builder-clientjs",
);
const packageJsonPath = path.join(packageDirectory, "package.json");
const sourcePath = path.join(
  packageDirectory,
  "dist",
  "clientParamBuilder.bundle.js",
);
const destinationDirectory = path.join(
  frontendDirectory,
  "public",
  "vendor",
  "meta-capi-param-builder",
  EXPECTED_VERSION,
);
const destinationPath = path.join(
  destinationDirectory,
  "clientParamBuilder.bundle.js",
);

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
if (packageJson.version !== EXPECTED_VERSION) {
  throw new Error(
    `Expected meta-capi-param-builder-clientjs ${EXPECTED_VERSION}, received ${packageJson.version}.`,
  );
}

await mkdir(destinationDirectory, { recursive: true });
await copyFile(sourcePath, destinationPath);

console.log(
  `Meta Parameter Builder ${EXPECTED_VERSION} synced to public/vendor.`,
);
