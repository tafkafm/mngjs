# mngjs

Move logic out of code and into data. mngjs evaluates MongoDB-style query and aggregation expressions against plain JavaScript objects — queries are plain JSON, storable in a database, editable at runtime, and explainable via a built-in trace.

Works in Node.js, browser, and React Native.

Query objects are plain JSON with no functions, no closures. They can be stored in a database, sent over the wire, edited at runtime, and loaded from config — enabling rule engines and state machines where the rules themselves are data rather than code.

`Query` interprets the query tree on every call. `CompileQuery` walks it once and returns a plain closure that up to 58× faster — suitable for filtering large datasets in a tight loop. Both accept the same query shape.

## Highlights

### Small footprint — 15.9 kB minified + gzipped, one runtime dependency

41.4 kB packed / 199.6 kB unpacked as an npm tarball; 69.4 kB minified / 15.9 kB minified + gzipped as a browser bundle (measured via esbuild, the same bundler [bundlephobia](https://bundlephobia.com/package/@tafkafm/mngjs) uses).

The most popular alternative is ~210 kB packed / ~1.1 MB unpacked.

### Double deref (`$$field`)

`$$field` reads the value of a named field, then uses *that value* as a second field name to look up. This enables dynamic comparisons driven entirely by the data.

```js
const rows = [{ index: 2, derefed: 2, redirect: "derefed" }];
rows.filter(Query({ index: "$$redirect" }));
// redirect = "derefed" → resolves row["derefed"] = 2 → matches row.index === 2 ✓
```

Double deref also accepts dotted key paths for nested field access. 

```js
  const rows = [{ a: { b: { c: { d: "a.b.c.value", value: "value" } } } }]

  rows.filter(Query({"$$a.b.c.d": "value"}));
```
matches the nested value at `a.b.c.value`

### Simpler syntax: no `$expr` needed (and not supported)

In MongoDB, expressions inside query operators require an explicit `$expr` wrapper. Here, expressions are evaluated uniformly everywhere — in `$match`, field comparisons, `$cond` branches, and anywhere else a value is expected.

```js
// MongoDB requires: { $match: { $expr: { $gt: ["$score", "$passing"] } } }
// Here (Aggregate or Query):
Aggregate([ { $gt: ["$score", "$passing"] }], data);
```

This isn't just simpler syntax — it measures faster. Compared with [mingo](https://github.com/kofrasa/mingo) which is the most widely-used MongoDB-style query library for JavaScript with a comparable feature set (which makes it a fair performance baseline), mngjs benchmarked on 10,000 rows (see [benchmark script](test/perf.js) — run with `npm install mingo && node test/perf.js --with-mingo`) **up to 12× faster** on expressions that require mingo's `$expr` wrapper. On plain query operators, where mingo doesn't need `$expr`, performance is roughly equal.

### Simpler syntax: implicit `$match`

All { key | expression : value } pairs are an implicit `$match` (`$eq`) expression (multiple keys are combined with `$and`)

### Query syntax examples

Comparisons can be written in multiple equivalent forms depending on what reads most naturally. Full paths to nested elements are accepted:

```js
// Scalar shorthand — value compared against the row element itself
data.filter(Query({ $eq: 5 }));             // works on arrays of primitives

// Field equality — implicit $eq
data.filter(Query({ index: 5 }));           // sugar for { index: { $eq: 5 } }

// Multiple fields — all must match (implicit $and)
data.filter(Query({ status: "active", score: { $gt: 50 } }));

// Dot-path notation — nested fields without wrapping objects
data.filter(Query({ "address.city": "Berlin" }));
data.filter(Query({ "scores.0": 100 }));    // array index access

// Field-to-field comparison via $-reference
data.filter(Query({ index: "$referenced" })); // passes where row.index === row.referenced

// Double-deref: $$ looks up a field whose name is stored in another field
data.filter(Query({ index: "$$deref" })); // row.deref = "derefed" → compares row.index to row.derefed

// $literal — pass a string or object through without $-resolution or dot-path expansion
data.filter(Query({ $eq: ["$status", { $literal: "$active" }] })); // matches rows where status === "$active" literally

// $$CURRENT — the current row, by reference (no clone)
Aggregate([{ $replaceWith: { $mergeObjects: ["$$CURRENT", { source: "db" }] } }], data);
// $$ROOT — deep clone of the current row

// Expression in comparator position — no $expr wrapper required
data.filter(Query({
  $eq: [{ $size: "$array" }, "$$test"]      // size of $array equals value of field named by row.test
}));

// Array push — "field[]" in a $set key path appends to an array field
Aggregate([{ $set: { "tags[]": "new-tag" } }], data);
// Equivalent to Array.push — "new-tag" is appended to the end of row.tags
```

### `$project` adds and removes fields

In MongoDB, `$project` is include-or-exclude only — you cannot add computed fields in the same stage as suppressing existing ones. Here, `$project` supports both simultaneously: include fields, exclude fields, and add computed expressions all in one stage.

```js
Aggregate([{
  $project: {
    name: 1,                                    // include
    _id: 0,                                     // exclude
    total: { $sum: "$scores" },                 // computed
    grade: { $cond: [{ $gte: ["$avg", 90] }, "A", "B"] }  // computed
  }
}], data);
```

MongoDB requires splitting this across `$project` and `$addFields`. Here one stage is enough.

### Failure trace — know *why* a rule didn't match

When a query fails, `Aggregate` returns structured reasons in a `trace` array. Each message shows the operator, the expression, and the resolved value — making it easy to explain to a user or log for debugging. No other library exposes this.

```js
const orders = [
  { total: 85,  status: "shipped",  items: 2 },  // fails — total too low, items too few
  { total: 250, status: "shipped",  items: 5 },  // passes
];

const { value, trace } = Aggregate([
  { $match: { total: { $gte: 200 }, status: "shipped", items: { $gt: 3 } } }
], orders);

// trace → [
//   "$gte: 85(85) is not greater than or equal to 200(200)",  ← total too low
//   "$gt: 2(2) is not greater than 3(3)"                     ← not enough items
// ]
```

The `85(85)` notation is `expression(resolvedValue)` — for indirect references like `$$pointer` or computed expressions, both the expression and what it resolved to are shown.

Trace output is only accessible via `Aggregate` and `Explain` — `Query` and `Test` are plain predicates with nowhere to return it.

### `Explain` — trace passing *and* failing conditions

`Explain` is a drop-in replacement for `Aggregate` that sets `forceTrace: true`. Every condition returns a trace message regardless of whether it passed or failed, giving a full picture of why each row was kept or dropped.

```js
const data = [
  { name: "Alice", score: 85, status: "active" },    // passes
  { name: "Bob",   score: 42, status: "active" },    // fails — score too low
  { name: "Carol", score: 91, status: "inactive" },  // fails — wrong status
];

const { value, trace } = Explain([
  { $match: { status: "active", score: { $gt: 50 } } }
], data);

// trace → [
//   // Alice — passed
//   "$match: passed",
//   "$gt: 85(85) is greater than 50(50)",
//   "$eq: active(active) equals active(active)",
//   // Bob — failed (score too low; status still checked first and passed)
//   "$match failed: {'status':'active','score':{'$gt':50}}",
//   "$gt: 42(42) is not greater than 50(50)",
//   "$eq: active(active) equals active(active)",
//   // Carol — failed (status checked first and failed; score never evaluated)
//   "$match failed: {'status':'active','score':{'$gt':50}}",
//   "$eq: inactive(inactive) does not equal(===) to active(active)"
// ]
```

`forceTrace` can also be passed directly to `Aggregate` as an option.

### `CompileQuery` — pre-compiled predicates for hot paths

`CompileQuery` accepts the same query shape as `Query` but walks the tree once at call time and returns a plain closure. Each subsequent call does no operator dispatch, making it significantly faster when the same query is applied to many rows.

```js
import { Query, CompileQuery } from "@tafkafm/mngjs";

const isActive = CompileQuery({ status: "active", score: { $gt: 50 } });
const results  = data.filter(isActive);  // no per-row parse overhead
```

Compile once, reuse across any number of filter calls:

```js
// ✗ re-parses the query on every filter call
data.filter(Query({ status: "active" }));

// ✓ parse once, reuse the closure
const predicate = CompileQuery({ status: "active" });
data.filter(predicate);
```

Measured speedups on 10 000-row datasets (500 iterations each):

| Query type | Speedup |
|---|---|
| simple equality | 24× |
| multi-field | 20× |
| `$and` / `$or` | 33–37× |
| `$in` | 22× |
| `$cond` expression | 58× |
| arithmetic in predicate | 23× |
| complex combined | 31× |

`CompileQuery` is a drop-in replacement for `Query` — same input, same output, same supported operators. `Aggregate`, `Explain`, and tracing are unaffected.

### Tracing

Tracing is enabled by default. It can be controlled at two levels:

```js
import { Query, Aggregate, traceEnabled } from "@tafkafm/mngjs";

// Global default — disable for all calls (e.g. in production)
traceEnabled = false;

// Per-call override — takes precedence over the global, no cleanup needed
const { value, trace } = Aggregate(pipeline, rows, { trace: true });
const predicate = Query(query, { trace: false });
```

### `$func` — custom operators

`$func` lets you drop in a plain JavaScript function wherever an operator is expected. This covers any gap in built-in coverage without forking the library.

The function receives `(context, row, ...args)` and must return `{ value, trace }`. `context` exposes the engine internals (`evaluate`, `getField`, `getValue`, `getArgs`, `log`) so custom operators can call back into the query engine for sub-expressions.

```js
// Inline custom operator in a $set expression
Aggregate([{
  $set: {
    upper: {
      $func: (ctx, row) => ({
        trace: [],
        value: row.name?.toUpperCase()
      })
    }
  }
}], data);
```

**Example: weighted average as a group accumulator**

`$func` also works as a `$group` accumulator. The function receives `(context, groupRows)` — the full array of rows in the group — and returns `{ value, trace }`:

```js
const orders = [
  { region: "eu", revenue: 1000, weight: 3 },
  { region: "eu", revenue: 500,  weight: 1 },
  { region: "us", revenue: 800,  weight: 2 },
  { region: "us", revenue: 200,  weight: 2 },
];

const { value } = Aggregate([
  { $group: {
    _id: "$region",
    weightedAvg: { $func: (_ctx, groupRows) => {
      const total = groupRows.reduce((s, r) => s + r.weight, 0);
      const sum   = groupRows.reduce((s, r) => s + r.revenue * r.weight, 0);
      return { value: sum / total, trace: [] };
    }}
  }},
], orders);
// → [{ _id: "eu", weightedAvg: 875 }, { _id: "us", weightedAvg: 500 }]
```

### Quick start

```js
import { Query, Aggregate } from "@tafkafm/mngjs";

const data = [
  { name: "Alice", age: 30, score: 85 },
  { name: "Bob",   age: 25, score: 42 },
  { name: "Carol", age: 35, score: 91 },
];

// Filter
const adults = data.filter(Query({ age: { $gte: 30 } }));
// → [{ name: "Alice", ... }, { name: "Carol", ... }]

// Pipeline
const { value } = Aggregate([
  { $match: { score: { $gte: 50 } } },
  { $sort: { score: -1 } },
  { $set: { grade: { $cond: [{ $gte: ["$score", 90] }, "A", "B"] } } },
], data);
// → [{ name: "Carol", score: 91, grade: "A" }, { name: "Alice", score: 85, grade: "B" }]
```

---

## Installation

```bash
npm install @tafkafm/mngjs
```

Requires ES module support. Works in Node.js, browser (Vite, webpack, Next.js), and React Native.

---

## API

### `Query(query)(row) → boolean`

Returns a predicate function suitable for use with `Array.filter`, or any other single-row evaluation.

```js
const predicate = Query({ status: "active", score: { $gt: 50 } });
const result = data.filter(predicate);
```

### `Aggregate(pipeline, rows) → { value, trace }`

Runs a pipeline of stages over an array of rows. Returns an object with:

- `value` — the resulting array
- `trace` — structured failure reasons for rows that were filtered out (see [Tracing](#tracing))

```js
const { value, trace } = Aggregate([
  { $match: { active: true } },
  { $group: { _id: "$department", total: { $sum: "$salary" } } },
  { $sort: { total: -1 } },
], employees);
```

> **Note:** `Aggregate` clones the input by default (`clone: true`). Pass `clone: false` to skip cloning for a performance gain when mutation is acceptable.
> `Query` evaluates rows in place (`clone: false` by default). Pass `clone: true` to protect source rows when using mutation operators (`$set`, `$push`, `$pop`, etc.).

### `CompileQuery(query) → (row) => boolean`

Pre-compiles a query into a fast predicate. The query tree is walked once at call time; the returned function performs no operator dispatch on each invocation. Drop-in replacement for `Query` for repeated filtering.

```js
const isActive = CompileQuery({ status: "active", score: { $gt: 50 } });
const results  = data.filter(isActive);
```

### `Explain(pipeline, rows) → { value, trace }`

Identical to `Aggregate` but with `forceTrace: true` — trace messages are emitted for both passing and failing conditions on every row. Useful for debugging pipelines and building user-facing rule explanations.

---

## Supported operators

### Query / filter
`$eq` `$eq2` (loose `==`) `$ne` `$ne2` (loose `!=`) `$gt` `$gte` `$lt` `$lte` `$in` `$nin` `$regex` `$exists` `$nonnull` `$and` `$or` `$nor` `$not` `$all` `$elemMatch` `$deq` (deep equality) `$bitsAllSet` `$bitsAllClear` `$bitsAnySet` `$bitsAnyClear`

### Pipeline stages
`$match` `$set` / `$addFields` `$unset` `$project` `$replaceRoot` / `$replaceWith` `$group` `$sort` `$sortByCount` `$skip` `$limit` `$count` `$sample` `$unwind` `$lookup`

### Arithmetic
`$add` `$subtract` `$multiply` / `$mul` `$divide` `$mod` `$pow` `$abs` `$ceil` `$floor` `$round` `$sqrt` `$trunc` `$exp` `$ln` `$log` `$log10` `$sum` `$avg` `$min` `$max` `$cmp`

### Trigonometric
`$sin` `$cos` `$tan` `$asin` `$acos` `$atan` `$atan2` `$sinh` `$cosh` `$tanh` `$asinh` `$acosh` `$atanh` `$degreesToRadians` `$radiansToDegrees`

### Bitwise
`$bitAnd` `$bitOr` `$bitXor` `$bitNot`

### Random
`$rand`

### String
`$concat` / `$strConcat` `$toLower` `$toUpper` `$toString` `$strLenCP` `$substr` `$split` `$trim` `$ltrim` `$rtrim` `$indexOfCP` `$regexMatch` `$regexFind` `$regexFindAll` `$replaceOne` `$replaceAll`

### Array
`$size` `$push` `$pop` `$concatArrays` `$elemAt` `$filter` `$map` `$reduce` `$slice` `$first` `$reverseArray` `$range` `$indexOfArray` `$sortArray` `$zip` `$flatten` `$arrayToObject` `$objectToArray` `$allElementsTrue` `$anyElementTrue`

### Set
`$setUnion` `$setIntersection` `$setDifference` `$setEquals` `$setIsSubset`

### Conditional
`$cond` `$switch` `$ifNull`

### Type
`$type` `$isArray` `$isNumber` `$isString` `$isObject` `$isDate` `$toInt` `$toDouble` `$toBool` `$toDate`

### Date
`$date` `$dateToString` `$dateFromString` `$dateAdd` `$dateSubtract` `$dateDiff` `$year` `$month` `$dayOfMonth` `$dayOfWeek` `$dayOfYear` `$hour` `$minute` `$second` `$millisecond` `$isoDayOfWeek` `$isoWeek` `$isoWeekYear` `$week`

All date operators work in UTC, deliberately, so results are identical regardless of the host machine's system timezone — the same query produces the same output whether it runs on a server set to `UTC`, `Europe/Berlin`, or anywhere else.

- **Date-time strings without an explicit offset** (e.g. `"1976-12-27T12:34:56"`) are parsed as UTC. This differs from raw JavaScript, where `new Date("1976-12-27T12:34:56")` parses as local time per spec — a well-known footgun that makes the same input produce different `Date` instants depending on where the code runs. mngjs normalizes this before parsing.
- **Date-time strings with an explicit offset** (e.g. `"2026-01-01T00:00:00+05:30"`, `"...Z"`) are interpreted using that offset, as expected.
- **Date-only strings** (e.g. `"1976-12-27"`) are already UTC per the JS spec — unaffected.
- `$dateToString` formats using UTC getters throughout, so its output never depends on `process.env.TZ` or the host's local clock settings.

### Object / misc
`$mergeObjects` `$let` `$literal`

### Group accumulators
`$sum` `$avg` `$min` `$max` `$push` `$first` `$last` `$addToSet` `$count` `$stdDevPop` `$stdDevSamp`

---

## Security

### ReDoS — regex patterns from untrusted sources

mngjs does not validate regex patterns before executing them. A malicious pattern such as `(a+)+$` matched against a crafted input string can cause catastrophic backtracking and block the Node.js event loop indefinitely.

If queries are loaded from a database, received over an API, or otherwise authored by untrusted parties, validate `$regex` patterns before passing them to mngjs. Libraries such as [`safe-regex2`](https://www.npmjs.com/package/safe-regex2) or [`recheck`](https://www.npmjs.com/package/recheck) can statically detect dangerous patterns.

This does not apply when queries are written by trusted developers at build time.

### Prototype pollution — mitigated

`__proto__`, `constructor`, and `prototype` keys are silently ignored in all merge and key-path write operations. Queries arriving via `JSON.parse` cannot pollute `Object.prototype` through `$set` or any other stage.

### `$func` — must never be constructed from untrusted input

`$func` accepts an arbitrary JavaScript function and cannot arrive via `JSON.parse`. It is only a risk if query objects are constructed programmatically from untrusted data (e.g. string interpolation). Keep `$func` values as static code.

---

## Comparison with mingo

[mingo](https://github.com/kofrasa/mingo) is the most widely-used MongoDB-style query library for JavaScript. Both libraries support the core query and aggregation pipeline. The table below covers the differences.

| Feature | mingo | mngjs |
|---|---|---|
| Packed size | ~210 kB | ~41.4 kB |
| Unpacked size | ~1.1 MB | ~199.6 kB |
| Minified + gzipped | — | ~15.9 kB |
| Expression performance (`$expr` required in mingo) | baseline | up to 12× faster |
| Pre-compiled predicates | Yes — `new Query(criteria)` compiles once | Yes — `CompileQuery(query)` compiles once |
| Expression in `$match` | Requires `$expr` wrapper | Works directly, no wrapper needed |
| `$project` with mixed include/exclude/compute | No — requires separate stages | Yes — one stage |
| Double-deref (`$$field`) | No | Yes — resolves field-of-field at query time |
| Failure trace | No | `trace` array on every `Aggregate` result |
| Full explain (passing + failing) | No | `Explain` / `forceTrace` option |
| Custom operators | `useOperators` registry | `$func` inline — no registration needed |
| Custom group accumulators | `$accumulator` | `$func` in `$group` |
| MongoDB operator coverage | More complete | Core + trig/bitwise/stats operators; niche gaps covered via `$func` |

---

## Differences from MongoDB

### Intentional deviations

| Feature | MongoDB | mngjs |
|---|---|---|
| Expression in query | Requires `$expr` wrapper | Works directly everywhere |
| `$let` variable prefix | `$$varName` | `_$varName` (`$$` is used for double-deref) |
| Double-deref | Not supported in query layer | `$$field` resolves field-of-field |
| Failure explanation | Not available | `trace` array on every `Aggregate` return value |
| Full condition trace | Not available | `Explain` traces both passing and failing conditions per row |

### Not implemented

- `$dateFromParts`, `$dateTrunc`
- `$graphLookup`, `$facet`, `$bucket`, `$bucketAuto`
- `$out`, `$merge` (write-back stages — not applicable to in-memory use)
- Query operators: `$text`, `$where`, `$geoNear`, `$jsonSchema`
- Full collation / locale-aware string comparison

---

## Running tests

```bash
node test/test.js
# or
npm test
```

The test runner uses no external framework. Pass/fail counts are printed at the end. Set `DEBUG_LOG = true` at the top of `test/test.js` for verbose per-row trace output.
