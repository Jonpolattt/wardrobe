# Web React type boundary

Final monorepo validation caught one TypeScript error in `apps/web/src/components/providers/Providers.tsx`: its global `React.ReactNode` included `bigint` from React 19 while its existing provider expected React 18. Direct web dependency resolution still selected React 18.3.1 and @types/react 18.3.31; native correctly selected React 19.2.3 and @types/react 19.2.14. No package version was upgraded.

The trace showed Next 14's triple-slash references to `react/experimental` and `react-dom/experimental`. TypeScript followed Next's real pnpm store path and resolved those subpaths through the hidden workspace React 19 types, importing React 19 experimental/canary declarations into the web's global React namespace. Merely restricting ambient `types`/`typeRoots` did not fix those explicit references.

The narrow solution is `compilerOptions.preserveSymlinks: true` in the web tsconfig. It retains the application-local dependency path for TypeScript resolution. A fresh trace then resolves both experimental declarations to the web's React 18 types, contains no React 19 types, and the web type check passes. Runtime dependency versions and Next's webpack symlink configuration are unchanged; this is a compiler resolution boundary. Recheck it when Next/React or package layout changes.

Diagnostic logs are ignored local artifacts: `.local/validation/web-react-resolution.log`, `web-react-typeRoots.log`, and `web-react-preserveSymlinks.log`. The existing npm lockfiles and all 724 baseline pnpm package records/dependency snapshots remain intact.
