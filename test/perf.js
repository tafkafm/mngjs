// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

// Usage:
//   node test/perf.js                # mngjs-only (Query vs CompileQuery)
//   npm install mingo && node test/perf.js --with-mingo
//
// mingo (github.com/kofrasa/mingo) is NOT a project dependency — it's only
// imported dynamically, and only when --with-mingo is passed, so it never
// affects `npm install` for regular contributors. It's used as an optional
// performance baseline since it's the most widely-used MongoDB-style query
// library for JS, with a comparable feature set.

import { Query, CompileQuery } from "../index.js";

const WITH_MINGO = process.argv.includes("--with-mingo");

let MingoQuery = null;
if (WITH_MINGO) {
  try {
    ({ Query: MingoQuery } = await import("mingo"));
  } catch {
    console.error(
      "\n--with-mingo was passed, but mingo isn't installed.\n" +
      "Run: npm install mingo\n"
    );
    process.exit(1);
  }
}

// ─── dataset ──────────────────────────────────────────────────────────────────

const ROWS = 10_000;

const statuses = ["active", "inactive", "pending", "suspended"];
const departments = ["eng", "sales", "support", "marketing"];

const data = Array.from({ length: ROWS }, (_, i) => ({
  id: i,
  name: `User ${i}`,
  score: Math.floor(Math.random() * 200),
  age: 18 + Math.floor(Math.random() * 50),
  status: statuses[i % statuses.length],
  department: departments[i % departments.length],
  tags: ["tag" + (i % 5), "tag" + (i % 3)],
  address: { city: i % 2 === 0 ? "Berlin" : "London" },
  redirect: "score",
}));

// ─── bench helper ─────────────────────────────────────────────────────────────

const bench = (label, fn, iterations = 500) => {
  // warmup
  for (let i = 0; i < 10; i++) { fn(); }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) { fn(); }
  const ms = performance.now() - start;

  return { label, ms, iterations, perIter: ms / iterations };
};

/**
 * Benchmarks mngjs Query and CompileQuery, and (if --with-mingo) mingo, on
 * the same criteria. Pass `mingoCriteria: null` to skip mingo (for
 * mngjs-only syntax like double-deref that has no direct mingo equivalent).
 */
const compare = (name, query, mingoCriteria, iterations = 500) => {
  const predicate = Query(query);
  const compiled  = CompileQuery(query);

  const r1 = bench(`${name} › Query`,        () => data.filter(predicate), iterations);
  const r2 = bench(`${name} › CompileQuery`, () => data.filter(compiled),  iterations);

  console.log(`\n── ${name} (${ROWS} rows × ${iterations} iters) ──`);
  console.log(`   Query        ${r1.perIter.toFixed(3)} ms/iter`);
  console.log(`   CompileQuery ${r2.perIter.toFixed(3)} ms/iter`);

  let mingoCount = null;
  if (MingoQuery && mingoCriteria !== null) {
    const mq = new MingoQuery(mingoCriteria);
    const r3 = bench(`${name} › mingo`, () => data.filter(doc => mq.test(doc)), iterations);
    console.log(`   mingo        ${r3.perIter.toFixed(3)} ms/iter`);

    const fastest = [r1, r2, r3].reduce((a, b) => (a.perIter < b.perIter ? a : b));
    console.log(`   fastest: ${fastest.label.split("› ")[1]} (${(Math.max(r1.perIter, r2.perIter, r3.perIter) / fastest.perIter).toFixed(2)}× over slowest)`);

    mingoCount = data.filter(doc => mq.test(doc)).length;
  } else {
    const speedup = r1.perIter / r2.perIter;
    const faster  = speedup >= 1 ? "CompileQuery" : "Query";
    const ratio   = speedup >= 1 ? speedup : 1 / speedup;
    console.log(`   ${faster} is ${ratio.toFixed(2)}× faster`);
    if (WITH_MINGO) {
      console.log(`   mingo        — (no equivalent, mngjs-specific syntax)`);
    }
  }

  // sanity check: flag if result counts diverge (semantics mismatch, not a timing issue)
  const queryCount = data.filter(predicate).length;
  const compiledCount = data.filter(compiled).length;
  if (queryCount !== compiledCount || (mingoCount !== null && queryCount !== mingoCount)) {
    console.log(`   ⚠ result count mismatch: Query=${queryCount} CompileQuery=${compiledCount} mingo=${mingoCount ?? "n/a"}`);
  }
};

// ─── benchmarks ───────────────────────────────────────────────────────────────

console.log(`\nmngjs${WITH_MINGO ? " vs mingo" : ""} performance: Query vs CompileQuery  (dataset: ${ROWS} rows)\n`);

compare("simple equality",
  { status: "active" },
  { status: "active" }
);

compare("comparison",
  { score: { $gt: 100 } },
  { score: { $gt: 100 } }
);

compare("multi-field",
  { status: "active", score: { $gt: 50 }, age: { $lt: 40 } },
  { status: "active", score: { $gt: 50 }, age: { $lt: 40 } }
);

compare("logical $and",
  { $and: [{ status: "active" }, { score: { $gte: 80 } }, { age: { $lte: 50 } }] },
  { $and: [{ status: "active" }, { score: { $gte: 80 } }, { age: { $lte: 50 } }] }
);

compare("logical $or",
  { $or: [{ status: "active" }, { status: "pending" }] },
  { $or: [{ status: "active" }, { status: "pending" }] }
);

compare("$in",
  { status: { $in: ["active", "pending"] } },
  { status: { $in: ["active", "pending"] } }
);

compare("dot-path nested",
  { "address.city": "Berlin" },
  { "address.city": "Berlin" }
);

compare("double-deref $$field",
  { id: "$$redirect" },
  null // mngjs-only feature — no direct Mongo/mingo equivalent
);

compare("$regex",
  { name: { $regex: "^User [0-9]$" } },
  { name: { $regex: "^User [0-9]$" } }
);

// mngjs allows bare expressions in $match position; standard Mongo/mingo
// requires an explicit $expr wrapper for the equivalent query.
compare("$cond expression",
  { $eq: [{ $cond: [{ $gt: ["$score", 100] }, "high", "low"] }, "high"] },
  { $expr: { $eq: [{ $cond: [{ $gt: ["$score", 100] }, "high", "low"] }, "high"] } }
);

compare("arithmetic in predicate",
  { $gt: [{ $add: ["$score", "$age"] }, 150] },
  { $expr: { $gt: [{ $add: ["$score", "$age"] }, 150] } }
);

compare("complex combined",
  {
    $and: [
      { status: { $in: ["active", "pending"] } },
      { score: { $gt: 50 } },
      { $or: [{ "address.city": "Berlin" }, { age: { $lt: 30 } }] },
    ]
  },
  {
    $and: [
      { status: { $in: ["active", "pending"] } },
      { score: { $gt: 50 } },
      { $or: [{ "address.city": "Berlin" }, { age: { $lt: 30 } }] },
    ]
  }
);

// ─── compile-once reuse benefit ───────────────────────────────────────────────

console.log("\n── compile-once vs new predicate each call ──");
const query = { status: "active", score: { $gt: 50 }, age: { $lt: 40 } };
const ITERS = 500;

const r1 = bench("new Query each call",
  () => data.filter(Query(query)),
  ITERS
);
const compiled = CompileQuery(query);
const r2 = bench("compiled once, reused",
  () => data.filter(compiled),
  ITERS
);

console.log(`   new Query each call   ${r1.perIter.toFixed(3)} ms/iter`);
console.log(`   compiled once, reused ${r2.perIter.toFixed(3)} ms/iter`);
console.log(`   speedup: ${(r1.perIter / r2.perIter).toFixed(2)}×`);

console.log();
