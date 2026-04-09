// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import { Query, CompileQuery } from "../index.js";
import { Logger, LogLevels, LogColor } from "../lib/logger.js";
import deepEqual from "fast-deep-equal";
import { toString } from "../lib/utils.js";

const logger = new Logger({
  defaultLogLevel: LogLevels.INFO,
  logLevel: LogLevels.INFO,
  location: "compile-test"
});

const testResults = { pass: 0, fail: [] };

/**
 * Run a single test case: apply both Query and CompileQuery to `input`,
 * assert both produce the same result, and assert the result equals `expected`.
 */
const testCompile = (key, description, input, query, expected) => {
  let error = null;

  let queryResult, compileResult;

  try {
    queryResult   = input.filter(Query(query));
    compileResult = input.filter(CompileQuery(query));
  } catch (e) {
    error = e;
  }

  const pass =
    !error &&
    deepEqual(queryResult, expected) &&
    deepEqual(compileResult, expected);

  testResults.pass += ~~pass;

  if (!pass) {
    testResults.fail.push(key);
    const reason = error
      ? error.message
      : !deepEqual(queryResult, expected)
        ? `Query mismatch: got ${toString(queryResult)}, expected ${toString(expected)}`
        : `CompileQuery mismatch: got ${toString(compileResult)}, expected ${toString(expected)}`;
    logger.log(`compile:${key}`, `FAIL [${key}] ${description} — ${reason}`, LogColor.RED);
  } else {
    logger.log(`compile:${key}`, `pass [${key}] ${description}`, LogColor.GREEN);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Shared datasets
// ──────────────────────────────────────────────────────────────────────────────

const people = [
  { name: "Alice", score: 80, status: "active",  tags: ["a", "b"],    address: { city: "Berlin" } },
  { name: "Bob",   score: 45, status: "inactive", tags: ["b", "c"],    address: { city: "Paris"  } },
  { name: "Carol", score: 95, status: "active",   tags: ["a", "c"],    address: { city: "Berlin" } },
  { name: "Dave",  score: 50, status: "active",   tags: ["d"],         address: { city: "Rome"   } },
];

// ──────────────────────────────────────────────────────────────────────────────
// 1.  Field-key with operator condition: { score: { $gt: 50 } }
// ──────────────────────────────────────────────────────────────────────────────

testCompile("field-gt", "field key $gt",
  people,
  { score: { $gt: 50 } },
  [people[0], people[2]]
);

testCompile("field-gte", "field key $gte",
  people,
  { score: { $gte: 50 } },
  [people[0], people[2], people[3]]
);

testCompile("field-lt", "field key $lt",
  people,
  { score: { $lt: 50 } },
  [people[1]]
);

testCompile("field-lte", "field key $lte",
  people,
  { score: { $lte: 50 } },
  [people[1], people[3]]
);

testCompile("field-ne", "field key $ne",
  people,
  { status: { $ne: "active" } },
  [people[1]]
);

testCompile("field-eq", "field key $eq",
  people,
  { status: { $eq: "active" } },
  [people[0], people[2], people[3]]
);

// ──────────────────────────────────────────────────────────────────────────────
// 2.  Operator-key with array args: { $gt: ["$score", "$passing"] }
// ──────────────────────────────────────────────────────────────────────────────

testCompile("opkey-gt-refs", "operator key $gt with field refs",
  [
    { score: 80, passing: 70 },
    { score: 60, passing: 70 },
    { score: 70, passing: 70 },
  ],
  { $gt: ["$score", "$passing"] },
  [{ score: 80, passing: 70 }]
);

testCompile("opkey-eq-refs", "operator key $eq with field refs",
  [
    { a: 1, b: 1 },
    { a: 1, b: 2 },
  ],
  { $eq: ["$a", "$b"] },
  [{ a: 1, b: 1 }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 3.  Multi-key query with short-circuit: { status: "active", score: { $gt: 50 } }
// ──────────────────────────────────────────────────────────────────────────────

testCompile("multi-key", "multi-key field query",
  people,
  { status: "active", score: { $gt: 50 } },
  [people[0], people[2]]
);

testCompile("multi-key-2", "multi-key with multiple sub-ops",
  people,
  { score: { $gt: 50, $lt: 95 } },
  [people[0]]   // Alice:80 only — Dave:50 fails $gt:50, Carol:95 fails $lt:95
);

// ──────────────────────────────────────────────────────────────────────────────
// 4.  Double-deref: { index: "$$redirect" }
// ──────────────────────────────────────────────────────────────────────────────

testCompile("double-deref", "double-deref $$field",
  [
    { a: { b: { c: { d: "a.b.c.value", value: "value" } } } },
    { a: { b: { c: { d: "key",         value: "value" } } } },
  ],
  { "$$a.b.c.d": "value" },
  [{ a: { b: { c: { d: "a.b.c.value", value: "value" } } } }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 5.  $and, $or, $nor, $not
// ──────────────────────────────────────────────────────────────────────────────

testCompile("and-1", "$and basic",
  people,
  { $and: [{ score: { $gte: 50 } }, { status: "active" }] },
  [people[0], people[2], people[3]]
);

testCompile("or-1", "$or basic",
  people,
  { $or: [{ score: { $lt: 50 } }, { status: "inactive" }] },
  [people[1]]
);

testCompile("nor-1", "$nor basic",
  people,
  { $nor: [{ score: { $gt: 80 } }, { status: "inactive" }] },
  [people[0], people[3]]
);

testCompile("not-1", "$not negates a field-equality sub-query",
  [{ active: true }, { active: false }, { active: true }],
  { $not: { active: true } },
  [{ active: false }]
);

testCompile("and-or-nested", "nested $and + $or",
  people,
  {
    $and: [
      { $or: [{ score: { $lt: 50 } }, { status: "inactive" }] },
      { name: { $ne: "Eve" } }
    ]
  },
  [people[1]]
);

// ──────────────────────────────────────────────────────────────────────────────
// 6.  $in, $nin
// ──────────────────────────────────────────────────────────────────────────────

testCompile("in-1", "$in membership",
  people,
  { name: { $in: ["Alice", "Carol"] } },
  [people[0], people[2]]
);

testCompile("nin-1", "$nin non-membership",
  people,
  { name: { $nin: ["Alice", "Carol"] } },
  [people[1], people[3]]
);

// ──────────────────────────────────────────────────────────────────────────────
// 7.  $let with _$ variables
// ──────────────────────────────────────────────────────────────────────────────

testCompile("let-1", "$let with _$ variable reference",
  [{ score: 80 }, { score: 40 }, { score: 60 }],
  {
    $let: {
      vars: { threshold: 50 },
      in: { $gt: ["$score", "_$threshold"] }
    }
  },
  [{ score: 80 }, { score: 60 }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 8.  $cond
// ──────────────────────────────────────────────────────────────────────────────

testCompile("cond-1", "$cond truthy branch",
  [{ x: 1 }, { x: 0 }, { x: 2 }],
  { $cond: [{ $gt: ["$x", 0] }, true, false] },
  [{ x: 1 }, { x: 2 }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 9.  $func
// ──────────────────────────────────────────────────────────────────────────────

testCompile("func-1", "$func custom function",
  [{ score: 80 }, { score: 30 }],
  { $func: (_ctx, row) => ({ value: row.score > 50, trace: [] }) },
  [{ score: 80 }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 10.  Dot-path field: { "address.city": "Berlin" }
// ──────────────────────────────────────────────────────────────────────────────

testCompile("dot-path-eq", "dot-path field equality",
  people,
  { "address.city": "Berlin" },
  [people[0], people[2]]
);

testCompile("dot-path-op", "dot-path field with operator",
  people,
  { "address.city": { $in: ["Berlin", "Rome"] } },
  [people[0], people[2], people[3]]
);

// ──────────────────────────────────────────────────────────────────────────────
// 11.  Regex
// ──────────────────────────────────────────────────────────────────────────────

testCompile("regex-1", "field key $regex string pattern",
  people,
  { name: { $regex: "^A" } },
  [people[0]]
);

testCompile("regex-2", "operator key $regex with field ref and string pattern",
  people,
  { $regex: ["$name", "^[AC]"] },
  [people[0], people[2]]
);

// ──────────────────────────────────────────────────────────────────────────────
// 12.  $exists
// ──────────────────────────────────────────────────────────────────────────────

testCompile("exists-1", "$exists true",
  [{ a: 1 }, { b: 2 }, { a: undefined }],
  { a: { $exists: true } },
  people.slice(0, 0).concat(  // just use Query parity
    [{ a: 1 }, { b: 2 }, { a: undefined }]
      .filter(Query({ a: { $exists: true } }))
  )
);

testCompile("exists-2", "$exists false",
  [{ a: 1 }, { b: 2 }],
  { a: { $exists: false } },
  [{ b: 2 }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 13.  $switch
// ──────────────────────────────────────────────────────────────────────────────

testCompile("switch-1", "$switch branches",
  [{ score: 90 }, { score: 60 }, { score: 30 }],
  {
    $switch: {
      branches: [
        { case: { $gte: ["$score", 80] }, then: true },
        { case: { $gte: ["$score", 50] }, then: false },
      ],
      default: false
    }
  },
  [{ score: 90 }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 14.  $ifNull
// ──────────────────────────────────────────────────────────────────────────────

testCompile("ifNull-1", "$ifNull returns first non-null",
  [{ val: null }, { val: 42 }, {}],
  { $eq: [{ $ifNull: ["$val", 0] }, 0] },
  [{ val: null }, {}]
);

// ──────────────────────────────────────────────────────────────────────────────
// 15.  Deep equality $deq
// ──────────────────────────────────────────────────────────────────────────────

testCompile("deq-1", "$deq deep equality",
  [
    { obj: { a: 1, b: 2 } },
    { obj: { a: 1, b: 3 } },
  ],
  { $deq: ["$obj", { a: 1, b: 2 }] },
  [{ obj: { a: 1, b: 2 } }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 16.  Implicit $eq  (plain field value)
// ──────────────────────────────────────────────────────────────────────────────

testCompile("implicit-eq", "implicit equality { field: value }",
  people,
  { status: "inactive" },
  [people[1]]
);

// ──────────────────────────────────────────────────────────────────────────────
// 17.  Arithmetic operators
// ──────────────────────────────────────────────────────────────────────────────

testCompile("add-1", "$add two fields",
  [{ a: 3, b: 4 }, { a: 1, b: 1 }],
  { $eq: [{ $add: ["$a", "$b"] }, 7] },
  [{ a: 3, b: 4 }]
);

testCompile("subtract-1", "$subtract",
  [{ a: 10, b: 3 }, { a: 5, b: 3 }],
  { $eq: [{ $subtract: ["$a", "$b"] }, 7] },
  [{ a: 10, b: 3 }]
);

testCompile("mul-1", "$mul (multiply)",
  [{ a: 3, b: 4 }, { a: 2, b: 5 }],
  { $eq: [{ $mul: ["$a", "$b"] }, 12] },
  [{ a: 3, b: 4 }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 18.  String operators
// ──────────────────────────────────────────────────────────────────────────────

testCompile("toLower-1", "$toLower equality",
  [{ name: "ALICE" }, { name: "BOB" }],
  { $eq: [{ $toLower: "$name" }, "alice"] },
  [{ name: "ALICE" }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 19.  Type operators
// ──────────────────────────────────────────────────────────────────────────────

testCompile("isArray-1", "$isArray",
  [{ v: [1, 2] }, { v: "str" }],
  { $isArray: "$v" },
  [{ v: [1, 2] }]
);

testCompile("isString-1", "$isString",
  [{ v: "hello" }, { v: 42 }],
  { $isString: "$v" },
  [{ v: "hello" }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 20.  $size (used as a predicate via $eq)
// ──────────────────────────────────────────────────────────────────────────────

testCompile("size-1", "$size of array",
  [{ arr: [1, 2, 3] }, { arr: [1] }],
  { $eq: [{ $size: "$arr" }, 3] },
  [{ arr: [1, 2, 3] }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 21.  $match
// ──────────────────────────────────────────────────────────────────────────────

testCompile("match-1", "$match operator",
  people,
  { $match: { status: "active", score: { $gt: 50 } } },
  [people[0], people[2]]
);

// ──────────────────────────────────────────────────────────────────────────────
// 22.  $$ROOT literal
// ──────────────────────────────────────────────────────────────────────────────

testCompile("root-eq", "$$ROOT clone equality via $deq",
  [{ a: 1 }, { a: 2 }],
  { $deq: ["$$ROOT", { a: 1 }] },
  [{ a: 1 }]
);

// ──────────────────────────────────────────────────────────────────────────────
// 23.  $nonnull
// ──────────────────────────────────────────────────────────────────────────────

testCompile("nonnull-1", "$nonnull field is not null",
  [{ v: null }, { v: 42 }, { v: "hi" }],
  { v: { $nonnull: true } },
  [{ v: 42 }, { v: "hi" }]
);

// ──────────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────────

const total = testResults.pass + testResults.fail.length;
logger.log("summary:total",  `Tests executed: ${total}`);
logger.log("summary:pass",   `Tests passed:   ${testResults.pass}`,  LogColor.GREEN);

if (testResults.fail.length > 0) {
  logger.log("summary:fail",
    `Tests failed:   ${testResults.fail.length} — ${testResults.fail.join(", ")}`,
    LogColor.RED
  );
} else {
  logger.log("summary:fail", `Tests failed:   0`, LogColor.GREEN);
}

process.exit(~~(testResults.fail.length > 0));
