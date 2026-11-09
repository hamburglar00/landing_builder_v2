/** Local cross-repository gate: review canonical changes before --update. */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const script=fileURLToPath(new URL("../../NexoBet/scripts/sync-builder-module.mjs",import.meta.url));
if(!existsSync(script))throw Error("Abrí Builder y NexoBet como carpetas vecinas antes de sincronizar el módulo compartido.");
const arg=process.argv.includes("--update")?"--update":"--check-sources";
const version=process.argv.find(value=>value.startsWith("--version="));
const result=spawnSync(process.execPath,[script,arg,...(version?[version]:[])],{stdio:"inherit",windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
