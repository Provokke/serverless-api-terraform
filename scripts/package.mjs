import { writeFileSync } from "node:fs";

// Lambda needs this marker next to the ESM output in dist/.
writeFileSync("dist/package.json", JSON.stringify({ type: "module" }) + "\n");
