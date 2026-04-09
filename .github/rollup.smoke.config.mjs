// CI-only: verifies the package bundles cleanly via Rollup (Vite's actual
// production bundler), which has different resolution/interop behavior than
// esbuild for the one CommonJS runtime dependency (fast-deep-equal).
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: "index.js",
  output: { file: "/tmp/bundle-rollup.js", format: "esm" },
  plugins: [nodeResolve(), commonjs()],
  onwarn(warning, _warn) {
    throw new Error(`Rollup smoke test warning: ${warning.message}`);
  }
};
