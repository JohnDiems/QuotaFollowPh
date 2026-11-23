# deepmerge security patch

Private, source-vendored compatibility fork of deepmerge 4.3.1 (MIT). The original bundled CommonJS implementation and types are retained. No unpatched upstream version is being represented as patched.

GHSA-gcqx-w48m-w2h4 has no upstream patched version as of 2026-11-12. Changes explicitly reject `__proto__`, `constructor`, and `prototype` keys in both the target-copy and source-merge paths, including nested/null-prototype input. This protects the returned object as well as Object.prototype. Regression tests exercise the actual dependency loaded by Rollup.

The package keeps deepmerge's callable export, `.all`, array concatenation, symbol copying, customMerge, arrayMerge, clone, and isMergeableObject options. The override is intentionally scoped to the dependency by name. Review and remove this fork when a verified upstream fix becomes available.

Source: https://github.com/TehShrike/deepmerge/tree/v4.3.1
Advisory: https://github.com/advisories/GHSA-gcqx-w48m-w2h4
