// Resolve hooks that let `node --experimental-strip-types` load the real services: they map the
// `@/` alias to apps/server and add the `.ts` extension that Next's bundler fills in for us.
import { statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const serverRoot = new URL("../../", import.meta.url);

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function typeScriptFile(url) {
  const path = fileURLToPath(url);
  const match = [path, `${path}.ts`, `${path}/index.ts`].find(isFile);
  return match ? pathToFileURL(match).href : null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = typeScriptFile(new URL(specifier.slice(2), serverRoot));
    if (url) {
      return { url, shortCircuit: true };
    }
  }

  const parent = context.parentURL ?? "";
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  if (relative && parent.startsWith("file:") && !parent.includes("/node_modules/") && !/\.[cm]?[jt]s$/.test(specifier)) {
    const url = typeScriptFile(new URL(specifier, parent));
    if (url) {
      return { url, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
