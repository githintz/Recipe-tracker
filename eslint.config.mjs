import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [".next/**", "node_modules/**", "data/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Recipe images come from hosts we can't enumerate ahead of time, so
      // <img> is deliberate; the rule is disabled per-use with a comment.
      "@next/next/no-img-element": "warn",
    },
  },
]

export default config;
