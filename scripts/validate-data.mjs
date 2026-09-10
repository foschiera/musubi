import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2] || "data/demo";
const ajv = new Ajv({ allErrors: true });
let failed = false;
for (const name of [
  "dataset_manifest",
  "events",
  "relationships",
  "sources",
  "taxonomies",
]) {
  try {
    const bytes = readFileSync(join(root, `${name}.json`));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text !== text.normalize("NFC"))
      throw new Error("DOM-02: text must be NFC normalized");
    const value = JSON.parse(text);
    const validate = ajv.compile(
      JSON.parse(readFileSync(`schemas/${name}.schema.json`, "utf8")),
    );
    if (!validate(value)) {
      failed = true;
      for (const error of validate.errors.slice(0, 50))
        console.error(`${name}.json ${error.instancePath}: ${error.message}`);
    }
  } catch (error) {
    failed = true;
    console.error(`${name}.json: ${error.message}`);
  }
}
if (failed) process.exit(1);
console.log("Dataset schemas and UTF-8/NFC checks passed.");
