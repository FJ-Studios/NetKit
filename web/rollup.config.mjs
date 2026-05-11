import typescript from "@rollup/plugin-typescript";

/** @type {import("rollup").RollupOptions} */
const config = {
  input: "src/index.ts",
  output: {
    file: "dist/index.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "./dist",
    }),
  ],
  external: [],
};

export default config;
