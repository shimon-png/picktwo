import { seed } from "../src/server/seed";

seed({ demo: process.argv.includes("--no-demo") ? false : true })
  .then((r) => {
    console.log("[seed]", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
