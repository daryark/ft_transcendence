import esbuild from "esbuild";
import { compileString } from "sass";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(rootDir, "src");
const publicDir = join(rootDir, "public");
const outDir = join(rootDir, "dist");
const assetsDir = join(outDir, "assets");

const isWatch = process.argv.includes("--watch");
const styles = new Map();

const scssPlugin = {
  name: "scss",
  setup(build) {
    build.onResolve({ filter: /\.scss$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path),
      namespace: "scss",
    }));

    build.onLoad({ filter: /\.scss$/, namespace: "scss" }, async (args) => {
      const source = await readFile(args.path, "utf8");
      const result = compileString(source, {
        loadPaths: [srcDir, dirname(args.path)],
        style: "compressed",
        url: pathToFileURL(args.path),
      });

      styles.set(args.path, result.css);
      return { contents: "", loader: "js" };
    });
  },
};

async function prepareDist() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });

  if (existsSync(publicDir)) {
    await cp(publicDir, outDir, { recursive: true });
  }
}

async function writeCss() {
  const css = Array.from(styles.entries())
    .sort(([left], [right]) => relative(rootDir, left).localeCompare(relative(rootDir, right)))
    .map(([, content]) => content)
    .join("\n");

  await writeFile(join(assetsDir, "app.css"), css);
}

async function writeHtml() {
  const template = await readFile(join(rootDir, "index.html"), "utf8");
  const html = template.replace(
    /<script type="module" src="\/src\/main\.tsx"><\/script>/,
    '<link rel="stylesheet" href="/assets/app.css" />\n    <script type="module" src="/assets/app.js"></script>',
  );

  await writeFile(join(outDir, "index.html"), html);
}

async function build() {
  styles.clear();
  await prepareDist();

  const options = {
    entryPoints: [join(srcDir, "main.tsx")],
    bundle: true,
    minify: !isWatch,
    sourcemap: isWatch,
    splitting: false,
    format: "esm",
    platform: "browser",
    target: ["es2023"],
    outfile: join(assetsDir, "app.js"),
    loader: {
      ".svg": "file",
      ".png": "file",
      ".jpg": "file",
      ".jpeg": "file",
      ".gif": "file",
      ".webp": "file",
      ".woff": "file",
      ".woff2": "file",
    },
    assetNames: "assets/[name]-[hash]",
    plugins: [scssPlugin],
  };

  if (isWatch) {
    const context = await esbuild.context(options);
    await context.watch();
    await writeCss();
    await writeHtml();
    console.log("Watching frontend sources...");
    return context;
  }

  await esbuild.build(options);
  await writeCss();
  await writeHtml();
}

await build();
