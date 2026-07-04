const esbuild = require("esbuild");

esbuild.build({
    entryPoints: ["index.js"],
    bundle: true,
    platform: "node",
    target: "node24",
    outfile: "dist/index.js",
    minify: false,
    sourcemap: false,
    external: [],
}).then(() => {

    console.log("✅ Connector build completed.");

}).catch(() => process.exit(1));