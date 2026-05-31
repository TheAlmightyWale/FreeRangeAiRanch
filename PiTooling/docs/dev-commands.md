# Dev Commands

## Install

```
npm install
```

---

## Type check

```
npm run typecheck
```

Runs `tsc --noEmit` — reports type errors without emitting any output files.

---

## Lint

```
npm run lint
```

Runs ESLint over `extensions/` and `tests/` using the flat config in `eslint.config.js`.

---

## Test

Run all tests once:

```
npm test
```

Watch mode (re-runs on file save):

```
npm run test:watch
```

### Filtering tests

Run a specific file:

```
npx vitest run tests/GitWorkflow.test.ts
```

Run tests whose name matches a pattern (substring or regex):

```
npx vitest run --reporter=verbose -t "branch creation"
```

Run a single named test:

```
npx vitest run -t "uses the name from setNextBranchName"
```

Pass `--reporter=verbose` to any command to see each test name in the output:

```
npm test -- --reporter=verbose
```
