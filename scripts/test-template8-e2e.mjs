import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const builder=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const frontend=resolve(builder,"frontend"),atrio=resolve(builder,"../internal-chat");
const container=`atrio-manager-validation-template8-${randomUUID().slice(0,8)}`;
const run=(cmd,args,cwd=builder,env=process.env)=>new Promise((done,fail)=>{
  const child=spawn(cmd,args,{cwd,env,stdio:"inherit",windowsHide:true});
  child.on("error",fail);child.on("exit",code=>code===0?done():fail(Error(`${cmd} exited ${code}`)));
});
let created=false;
try {
  await run(process.execPath,["scripts/build-classic-template7.mjs"]);
  await run("docker",["run","--detach","--name",container,"--network","none","-e","POSTGRES_USER=supabase_admin","-e","POSTGRES_PASSWORD=isolated-test-only","-e","POSTGRES_DB=validation","postgres:17-alpine"]);
  created=true;
  let ready=false;
  for(let attempt=0;attempt<60;attempt++){
    if(spawnSync("docker",["exec",container,"pg_isready","-U","supabase_admin","-d","validation"],{stdio:"ignore",windowsHide:true}).status===0){ready=true;break;}
    await new Promise(done=>setTimeout(done,500));
  }
  if(!ready)throw Error("Isolated Postgres did not become ready");
  const env={...process.env,ATRIO_MANAGER_TEST_CONTAINER:container};
  await run(process.execPath,["--experimental-strip-types","--test","tests/builder-manager-database.test.mjs","tests/builder-manager-destinations.test.mjs"],atrio,env);
  await run(process.execPath,["--test","tests/template8Database.test.mjs"],frontend,env);
  await run(process.execPath,["node_modules/tsx/dist/cli.mjs","--import","./tests/revalidation-server-loader.mjs","--test","tests/template8.test.ts"],frontend,env);
  await run(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/template8-e2e.ts"],frontend,env);
  console.log("Template 8: database, permissions, distribution, tracking and browser journeys passed. Screenshots: frontend/test-results/template8.");
} catch(error){console.error(error);process.exitCode=1;}
finally{
  if(created && /^atrio-manager-validation-template8-[a-f0-9]{8}$/.test(container))
    spawnSync("docker",["rm","--force",container],{stdio:"ignore",windowsHide:true});
}
