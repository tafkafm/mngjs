// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import { Aggregate, Query } from "../index.js"
import { ForceLog, LogColor, LogLevel, LogLevels, Logger } from "../lib/logger.js";
import deepEqual from "fast-deep-equal";
import { toString } from "../lib/utils.js";

const logger = new Logger({
  defaultLogLevel: LogLevels.INFO,
  logLevel: LogLevels.INFO,
  location: "test"
});

const DEBUG_LOG = false;

const testResults = {
  pass: 0,
  fail: []
}

const testQuery = (key, description, input, query, expectedValue, negate = false) => {

  logger.log(`query:${key}`, description, query);
  logger.log(`query:${key}`, `input: ${toString(input)}`);
  logger.log(`query:${key}`, `---`, LogLevel.DEBUG, ForceLog[DEBUG_LOG ? "TRUE" : "FALSE"]);

  const result = input.filter(Query(query, DEBUG_LOG));
  const pass = !negate * deepEqual(result, expectedValue);

  testResults.pass += ~~pass;

  if (!pass) {
    testResults.fail.push(key);
  }
  logger.log(`query:${key}`, `---`, LogLevel.DEBUG, ForceLog[DEBUG_LOG ? "TRUE" : "FALSE"]);

  logger.log(`query:${key}`, `${pass ? "pass" : "fail"}: ${toString(result)}\n`, pass ? LogColor.GREEN : LogColor.RED);
}

const testAggregate = (key, description, input, query, expectedValue, negate = false) => {

  logger.log(`aggregate:${key}`, description, query);
  logger.log(`aggregate:${key}`, `input: ${toString(input)}`);
  logger.log(`aggregate:${key}`, `---`, LogLevel.DEBUG, ForceLog[DEBUG_LOG ? "TRUE" : "FALSE"]);

  const result = Aggregate(query, input, DEBUG_LOG);
  const pass = !negate * deepEqual(result.value, expectedValue);

  testResults.pass += ~~pass;

  if (!pass) {
    testResults.fail.push(key);
  }
  logger.log(`aggregate:${key}`, `---`, LogLevel.DEBUG, ForceLog[DEBUG_LOG ? "TRUE" : "FALSE"]);

  logger.log(`aggregate:${key}`, `${pass ? "pass" : "fail"}: ${toString(result.value)}\n`, pass ? LogColor.GREEN : LogColor.RED);
}


let input;

// Test Cases

const inputEq = [
  { key: 1, value: "test" },
  { key: 2, value: "sample" }
];

const inputSize = [{ array: [1, 2, 3] }, { array: [1] }];

const inputElemMatch = [{ array: [1, 2, 3] }, { array: ["a", "b", "c"] }];

const inputMerge = [
  { key1: { a: 1 }, key2: { b: 2 } },
  { key1: { a: 3 }, key2: { b: 4 } }
];

// Equality and Inequality
testQuery("eq(1)", "simple equality check", inputEq, { key: { $eq: 1 } }, [{ key: 1, value: "test" }]);
testQuery("eq(2)", "simple equality check", inputEq, { $eq: ["$key", 1] }, [{ key: 1, value: "test" }]);
testQuery("eq(3)", "simple equality check", inputEq, { key: 1 }, [{ key: 1, value: "test" }]);

testQuery("ne(1)", "simple inequality check", inputEq, { key: { $ne: 1 } }, [{ key: 2, value: "sample" }]);

testQuery("regex(1)", "regex match", inputEq, { value: { $regex: "te" } }, [{ key: 1, value: "test" }]);


// Comparison
testQuery("gt(1)", "greater than check", inputEq, { key: { $gt: 1 } }, [{ key: 2, value: "sample" }]);
testQuery("gte(1)", "greater than or equal check", inputEq, { key: { $gte: 1 } }, inputEq);
testQuery("lt(1)", "less than check", inputEq, { key: { $lt: 2 } }, [{ key: 1, value: "test" }]);
testQuery("lte(1)", "less than or equal check", inputEq, { key: { $lte: 2 } }, inputEq);

// Membership
testQuery("in(1)", "membership in array", inputEq, { key: { $in: [1, 3] } }, [{ key: 1, value: "test" }]);
testQuery("nin(1)", "non-membership in array", inputEq, { key: { $nin: [1] } }, [{ key: 2, value: "sample" }]);

// Array Operators
testAggregate("size(1)", "array size comparison", inputSize, [{
  $set: { isThree: { $eq: [{ $size: "$array" }, 3] } }
}], [
  { array: [1, 2, 3], isThree: true },
  { array: [1], isThree: false }
]);

testQuery("elemMatch(1)", "element match in array", inputElemMatch, { array: { $elemMatch: 2 } }, [{ array: [1, 2, 3] }]);

testAggregate("elemAt(1)", "element at specific index", [{ array: ["a", "b", "c"] }], [{
  $set: { secondElement: { $elemAt: ["$array", 1] } }
}], [{ array: ["a", "b", "c"], secondElement: "b" }]);

// Logical Operators
testQuery("and(1)", "logical AND", inputEq, { $and: [{ key: { $gte: 1 } }, { value: { $eq: "test" } }] }, [{ key: 1, value: "test" }]);
testQuery("or(1)", "logical OR", inputEq, { $or: [{ key: { $eq: 1 } }, { value: { $eq: "sample" } }] }, inputEq);

// Conditional Operators
testAggregate("cond(1)", "conditional operator", [{ key: 1 }], [{
  $set: {
    result: {
      $cond: [{ $eq: ["$key", 1] }, "yes", "no"]
    }
  }
}], [{ key: 1, result: "yes" }]);

testAggregate("ifNull(1)", "ifNull operator", [{ key: null }], [{
  $set: {
    result: { $ifNull: ["$key", "default"] }
  }
}], [{ key: null, result: "default" }]);

// Projection and Transformations
testAggregate("project(1)", "project specific fields", [{ key: 1, value: "test" }], [{
  $project: { key: 1 }
}], [{ key: 1 }]);

testAggregate("set(1)", "set new fields", [{ key: 1 }], [{
  $set: {
    newField: { $eq: ["$key", 1] }
  }
}], [{ key: 1, newField: true }]);

testQuery("nested-indirect(1)", "use indirect addressing for nested fields",
  [{ a: { b: { c: { d: "a.b.c.value", value: "value" } } } }, { a: { b: { c: { d: "key", value: "value" } } } }],
  {
    "$$a.b.c.d": "value"
  },
  [{ a: { b: { c: { d: "a.b.c.value", value: "value" } } } }]
);

testAggregate("nested-indirect(2)", "use indirect addressing for nested fields in aggregation",
  [{ a: { b: { c: { d: "a.b.c.value", value: "value" } } } }, { a: { b: { c: { d: "key", value: "value" } } } }],
  [
    {
      "$$a.b.c.d": "value"
    }
  ],
  [{ a: { b: { c: { d: "a.b.c.value", value: "value" } } } }]
);

// Nested Logical Query
testQuery("and-or(1)", "nested AND and OR", inputEq, {
  $and: [
    { $or: [{ key: { $eq: 1 } }, { key: { $eq: 2 } }] },
    { value: { $eq: "test" } }
  ]
}, [{ key: 1, value: "test" }]);

// Nested Queries and Aggregations
testAggregate("mergeObjects(1)", "merge multiple objects", inputMerge, [{
  $set: {
    merged: { $mergeObjects: ["$key1", "$key2"] }
  }
}], [
  { key1: { a: 1 }, key2: { b: 2 }, merged: { a: 1, b: 2 } },
  { key1: { a: 3 }, key2: { b: 4 }, merged: { a: 3, b: 4 } }
]);

testAggregate("replaceRoot(1)", "replace root object", [{ nested: { a: 1, b: 2 } }], [{
  $replaceRoot: { newRoot: "$nested" }
}], [{ newRoot: { a: 1, b: 2 } }]);

// Aggregations and Arrays
testAggregate("push(1)", "push elements to array", [{ items: [1] }], [{
  $set: { items: { $push: ["$items", 2] } }
}], [{ items: [1, 2] }]);

testAggregate("pop(1)", "pop elements from array", [{ items: [1, 2, 3] }], [{
  $set: { items: { $pop: ["$items", 1] } }
}], [{ items: [1, 2] }]);

testAggregate("sum(1)", "sum array elements", [{ array: [1, 2, 3] }], [{
  $set: { total: { $sum: "$array" } }
}], [{ array: [1, 2, 3], total: 6 }]);

testAggregate("avg(1)", "average array elements", [{ array: [2, 4, 6] }], [{
  $set: { average: { $avg: "$array" } }
}], [{ array: [2, 4, 6], average: 4 }]);

// $elemAt
testAggregate("elemAt", "Element at specific index", [{ array: ["x", "y", "z"] }], [{
  $set: { secondElement: { $elemAt: ["$array", 1] } }
}], [{ array: ["x", "y", "z"], secondElement: "y" }]);

// $push
const inputPush = [
  { items: [1, 2] },
  { items: [] },
];
testAggregate("push", "Push elements to array", inputPush, [{
  $set: { items: { $push: ["$items", 3, 4] } }
}], [
  { items: [1, 2, 3, 4] },
  { items: [3, 4] },
]);

// $pop
const inputPop = [
  { items: [1, 2, 3, 4] },
  { items: [5, 6] },
];
testAggregate("pop", "Pop elements from array", inputPop, [{
  $set: { items: { $pop: ["$items", 2] } }
}], [
  { items: [1, 2] },
  { items: [] },
]);

// field[] key path push
testAggregate("keyPathPush(1)", "field[] in $set key path appends to an existing array", [
  { tags: ["a", "b"] },
], [{
  $set: { "tags[]": "c" }
}], [
  { tags: ["a", "b", "c"] },
]);

testAggregate("keyPathPush(2)", "field[] in $set key path creates array when field is absent", [
  { name: "x" },
], [{
  $set: { "tags[]": "first" }
}], [
  { name: "x", tags: ["first"] },
]);

// $concat
const inputConcat = [
  { array: [1, 2] },
  { array: [3, 4] },
];
testAggregate("concat", "Concatenate arrays", inputConcat, [{
  $set: { concatenated: { $concat: ["$array", [5, 6]] } }
}], [
  { array: [1, 2], concatenated: [1, 2, 5, 6] },
  { array: [3, 4], concatenated: [3, 4, 5, 6] },
]);

// 6. Conditional Operators
const inputCond = [
  { score: 85 },
  { score: 60 },
  { score: 75 },
];

// $cond
testAggregate("cond", "Conditional operator based on score", inputCond, [{
  $set: {
    grade: {
      $cond: [
        { $gte: ["$score", 80] }, // First condition
        "A",                       // First true-case
        {
          $cond: [
            { $gte: ["$score", 70] }, // Second condition
            "B",                       // Second true-case
            "C"                        // Second false-case
          ]
        }
      ]
    }
  }
}], [
  { score: 85, grade: "A" },
  { score: 60, grade: "C" },
  { score: 75, grade: "B" },
]);

// $ifNull
const inputIfNull = [
  { name: "Alice", age: 30 },
  { name: "Bob" },
  { name: "Charlie", age: null },
];
testAggregate("ifNull", "IfNull operator with missing and null fields", inputIfNull, [{
  $set: { ageOrDefault: { $ifNull: ["$age", 25] } },
  // $set: { maxAge: { $max: "$age" } }
}], [
  { name: "Alice", age: 30, ageOrDefault: 30 },
  { name: "Bob", ageOrDefault: 25 },
  { name: "Charlie", age: null, ageOrDefault: 25 },
]);

// 7. Existence Operators
const inputExists = [
  { name: "Alice", age: 30 },
  { name: "Bob" },
  { name: "Charlie", age: null },
];

// $exists
testQuery("exists", "Check existence of 'age' field", inputExists, {
  age: { $exists: true }
}, [
  { name: "Alice", age: 30 },
  { name: "Charlie", age: null },
]);

// $nonnull
testQuery("nonnull", "Check non-null 'age' field", inputExists, {
  age: { $nonnull: true }
}, [
  { name: "Alice", age: 30 },
]);

// 8. Transformation and Projection Operators

// $project
const inputProject = [
  { name: "Alice", age: 30, city: "New York" },
  { name: "Bob", age: 25, city: "Los Angeles" },
];
testAggregate("project", "Project specific fields", inputProject, [{
  $project: { name: 1, city: 1 }
}], [
  { name: "Alice", city: "New York" },
  { name: "Bob", city: "Los Angeles" },
]);

// $set
const inputSet = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
];
testAggregate("set", "Set new fields based on existing data", inputSet, [{
  $set: { isAdult: { $gte: ["$age", 18] } }
}], [
  { name: "Alice", age: 30, isAdult: true },
  { name: "Bob", age: 25, isAdult: true },
]);

// $mergeObjects
testAggregate("mergeObjects", "Merge multiple objects into one", inputMerge, [{
  $set: { merged: { $mergeObjects: ["$key1", "$key2"] } }
}], [
  { key1: { a: 1 }, key2: { b: 2 }, merged: { a: 1, b: 2 } },
  { key1: { a: 3 }, key2: { b: 4 }, merged: { a: 3, b: 4 } },
]);

// $replaceRoot
const inputReplaceRoot = [
  { nested: { a: 1, b: 2 } },
  { nested: { a: 3, b: 4, c: { d: 5 } } },
];
testAggregate("replaceRoot(1O", "Replace root object with nested object", inputReplaceRoot, [{
  $replaceRoot: "$nested"
}], [
  { a: 1, b: 2 },
  { a: 3, b: 4, c: { d: 5 } },
]);
testAggregate("replaceRoot(2)", "Replace root object with nested object", inputReplaceRoot, [{
  $replaceRoot: "$nested.c"
}], [
  { d: 5 },
]);

// $not
const inputNot = [
  { active: true },
  { active: false },
  { active: true },
];
testQuery("not", "Logical NOT on 'active' field", inputNot, { $not: { active: true } }, [
  { active: false },
]);

// 9. Bitwise Operators

const inputBits = [
  { flags: 5 },  // 0101
  { flags: 2 },  // 0010
  { flags: 0 },  // 0000
];

// $bitsAllSet
testQuery("bitsAllSet", "Bits all set", inputBits, { flags: { $bitsAllSet: 1 } }, [
  { flags: 5 }, // 0101 & 0001 = 0001 (true)
]);

// $bitsAllClear
testQuery("bitsAllClear", "Bits all clear", inputBits, { flags: { $bitsAllClear: 1 } }, [
  { flags: 2 }, { flags: 0 }// 0100 & 0001 = 0000 (true)
]);

// 10. Aggregation Operators: Mathematical Operations

const inputMath = [
  { numbers: [1, 2, 3] },
  { numbers: [4, 5, 6] },
  { numbers: [] },
];

// $sum
testAggregate("sum", "Sum array elements", inputMath, [{
  $set: { total: { $sum: "$numbers" } }
}], [
  { numbers: [1, 2, 3], total: 6 },
  { numbers: [4, 5, 6], total: 15 },
  { numbers: [], total: 0 },
]);

// $avg
testAggregate("avg", "Average array elements", inputMath, [{
  $set: { average: { $avg: "$numbers" } }
}], [
  { numbers: [1, 2, 3], average: 2 },
  { numbers: [4, 5, 6], average: 5 },
  { numbers: [], average: 0 },
]);

// $min
testAggregate("min", "Minimum of array elements", inputMath, [{
  $set: { minValue: { $min: "$numbers" } }
}], [
  { numbers: [1, 2, 3], minValue: 1 },
  { numbers: [4, 5, 6], minValue: 4 },
  { numbers: [], minValue: null }, // Assuming min of empty array is null
]);

// $max
testAggregate("max", "Maximum of array elements", inputMath, [{
  $set: { maxValue: { $max: "$numbers" } }
}], [
  { numbers: [1, 2, 3], maxValue: 3 },
  { numbers: [4, 5, 6], maxValue: 6 },
  { numbers: [], maxValue: null }, // Assuming max of empty array is null
]);

// 11. Complex and Combined Operators

// Nested $and with $or and $elemMatch
const inputComplexLogical = [
  { tags: ["javascript", "coding"], status: "active", searchValue: "tutorial" },
  { tags: ["python", "coding"], status: "inactive", searchValue: "tutorial" },
  { tags: ["javascript", "tutorial"], status: "active", searchValue: "tutorial" },
];

// Combined $and and $or with $elemMatch
testQuery("complex-logical", "Nested AND with OR and elemMatch", inputComplexLogical, {
  $and: [
    { status: { $eq: "active" } },
    { $or: [{ tags: { $elemMatch: "javascript" } }, { tags: { $elemMatch: "$searchValue" } }] }
  ]
}, [
  { tags: ["javascript", "coding"], status: "active", searchValue: "tutorial" },
  { tags: ["javascript", "tutorial"], status: "active", searchValue: "tutorial" },
]);

// Using $mergeObjects and $replaceRoot together
const inputMergeReplace = [
  { part1: { a: 1 }, part2: { b: 2 }, nested: { c: 3 } },
  { part1: { a: 4 }, part2: { b: 5 }, nested: { c: 6 } },
];
testAggregate("mergeReplace", "Merge objects and replace root", inputMergeReplace, [{
  $set: { merged: { $mergeObjects: ["$part1", "$part2"] } },
}, {
  $replaceRoot: "$merged"
}], [
  { a: 1, b: 2 },
  { a: 4, b: 5 },
]);

// Conditional Replacement and Projection
const inputCondReplace = [
  { score: 85, details: { name: "Alice" } },
  { score: 65, details: { name: "Bob" } },
];

// Replace root based on condition
testAggregate("condReplace", "Conditional replaceRoot based on score", inputCondReplace, [{
  $replaceRoot: {
    $cond: [
      { $gte: ["$score", 70] }, "$details", "$$ROOT"
    ]
  }
}], [
  { name: "Alice" },
  { score: 65, details: { name: "Bob" } },
]);

// 12. Additional Tests for Operators Not Previously Covered

// $not
const inputNotOperator = [
  { flag: true },
  { flag: false },
  { flag: true },
];
testQuery("not", "Logical NOT on flag", inputNotOperator, { $not: { flag: true } }, [
  { flag: false },
]);

// $bitsAllSet and $bitsAllClear with multiple bits
const inputBitsMultiple = [
  { flags: 7 },  // 0111
  { flags: 8 },  // 1000
  { flags: 15 }, // 1111
];

// $bitsAllSet for multiple bits (e.g., 3 and 4)
testQuery("bitsAllSet-multiple", "Bits all set for multiple bits", inputBitsMultiple, { flags: { $bitsAllSet: 3 } }, [
  { flags: 7 },
  { flags: 15 },
]);

// $bitsAllClear for multiple bits (e.g., 1 and 2)
testQuery("bitsAllClear-multiple", "Bits all clear for multiple bits", inputBitsMultiple, { flags: { $bitsAllClear: 3 } }, [
  { flags: 8 },
]);

// $nonnull
const inputNonnull = [
  { data: null },
  { data: 0 },
  { data: "test" },
  {},
];
testQuery("nonnull", "Check non-null 'data' field", inputNonnull, {
  data: { $nonnull: true }
}, [
  { data: 0 },
  { data: "test" },
]);

// $mergeObjects with overlapping keys
const inputMergeOverlap = [
  { obj1: { a: 1, b: 2 }, obj2: { b: 3, c: 4 } },
  { obj1: { a: 5 }, obj2: { c: 6 } },
];
testAggregate("mergeObjects-overlap", "Merge objects with overlapping keys", inputMergeOverlap, [{
  $set: { merged: { $mergeObjects: ["$obj1", "$obj2"] } }
}], [
  { obj1: { a: 1, b: 2 }, obj2: { b: 3, c: 4 }, merged: { a: 1, b: 3, c: 4 } },
  { obj1: { a: 5 }, obj2: { c: 6 }, merged: { a: 5, c: 6 } },
]);

// $replaceRoot with entire object
const inputReplaceEntire = [
  { info: { name: "Alice", age: 30, ages: [1, 2, 3] } },
  { info: { name: "Bob", age: 25 } },
];
testAggregate("replaceRoot-entire", "Replace root with entire 'info' object", inputReplaceEntire,
  [
    {
      $replaceRoot: "$info"
    },
    {
      $set: {
        total: { $sum: "$ages" },
        ages: undefined
      }
    }
  ],
  [
    { name: "Alice", age: 30, total: 6 },
    { name: "Bob", age: 25 },
  ]);

// $set with nested fields and functions
const inputSetNested = [
  { scores: [10, 20, 30] },
  { scores: [40, 50] },
];
testAggregate("set-nested", "Set nested fields with functions", inputSetNested, [{
  $set: {
    total: { $sum: "$scores" },
    highest: { $max: "$scores" },
    average: { $avg: "$scores" },
  }
}], [
  { scores: [10, 20, 30], total: 60, highest: 30, average: 20 },
  { scores: [40, 50], total: 90, highest: 50, average: 45 },
]);

input = new Array(10).fill(null).map((_, index) => index);

testQuery("eq(1)", "testing $eq on an array", input, {
  $eq: 5
}, [5]);

testQuery("lt(1)", "testing $lt on an array", input, {
  $lt: 5
}, [0, 1, 2, 3, 4]);

testQuery("lte(1)", "testing $lte on an array", input, {
  $lte: 5
}, [0, 1, 2, 3, 4, 5]);

testQuery("gt(1)", "testing $gt on an array", input, {
  $gt: 5
}, [6, 7, 8, 9]);

testQuery("gte(1)", "testing $gt on an array", input, {
  $gte: 5
}, [5, 6, 7, 8, 9]);

input = new Array(10).fill(null).map((_, index) => ({ index }));

testQuery("eq(2)", "testing $eq on an array with objects", input, {
  index: 5
}, [{ index: 5 }]);

input = {
  array: [1, 2, 3],
  test: "size",
  size: 3
};

testQuery("eq(3)", "testing $eq, $size, and indirect access via $$", [input],
  {
    $eq: [
      { $size: "$array" }, "$$test"
    ]
  }, [input])

input = {
  age: 42,
  third: 42,
  second: true,
  redirect: "third"
};

testQuery("eq(3)", "testing nested $eq with indirect access, then $eq of computed $eq value", [input],
  {
    second: {
      $eq: {
        $eq: ["$age", "$$redirect"],
      }
    },
    third: {
      $eq: "$$redirect"
    }
  }, [input]);

input = {
  array: [1, 2, 3],
  test: [1, 2, 3],
};

testQuery("$deq", "testing deep equal of arrays", [input], {
  $deq: ["$array", "$test"]
}, [input]);

input = {
  bam: "boom",
  bang: "boom",
  third: "3",
  array: [1, 2, 3, 4],
  last: 4,
  redirect: "$last"
};

testQuery("$in", "testing $in operator", [input], {
  bam: "boom",
  bang: "boom",
  third: "3",
  redirect: { $in: "$array" }
}, [input]);

testQuery("$nin", "testing $in operator", [input], {
  bam: "boom",
  bang: "boom",
  third: "3",
  redirect: { $nin: "$array" }
}, []);

input = [{
  bam: "boom",
  bang: "boom",
  third: "3",
  last: 6,
  array: [1, 2, 3]
}, {
  bam: "boom",
  bang: "boom",
  third: "3",
  last: 5,
  array: [1, 2, 3, 4]
}];

testAggregate("combined", "testing multiple stages. filter via $gt then $set, $mergedObjects, $$ROOT",
  input,
  [
    {
      $gt: ["$last", 5]
    },
    {
      $set: {
        last: 4,
        third: "$bang",
        size: { $size: "$array" },
        merged: {
          $mergeObjects: [
            "$$ROOT",
            {
              test: "blah"
            }
          ]
        },
      }
    }
  ],
  [{
    bam: "boom",
    bang: "boom",
    third: "boom",
    last: 4,
    size: 3,
    array: [1, 2, 3],
    merged: {
      bam: "boom",
      bang: "boom",
      third: "boom",
      last: 4,
      size: 3,
      array: [1, 2, 3],
      test: "blah"
    }
  }]
);

testAggregate("push:pop", "testing $set, $push, $pop, and $concat",
  [{
    array: [1, 2, 3, 4, 5, 6]
  }],
  [{
    $set: {
      nested: {
        popped: { $pop: ["$array", 1] },
      }
    },
  },
  {
    $set: {
      nested: {
        popped: { $concat: ["$nested.popped", 6] }
      }
    }
  },
  {
    $pop: ["$nested.popped", 3]
  },
  {
    $concat: ["$nested.popped", [4, 5, { $size: "$array" }]]
  },
  {
    $project: {
      result: "$nested.popped",
      nested: 0,
      array: 0
    }
  }],
  [{
    result: [1, 2, 3, 4, 5, 6]
  }]
);


input = new Array(5).fill(null).map((_, index) => ({ index }));

testAggregate("set:cond(result)", "test $set with nested $cond",
  input,
  [
    {
      $set: {
        result: {
          $cond: [
            {
              index: { $lte: 2 }
            },
            "a",
            "b"
          ]
        }
      }
    }
  ],
  [
    { index: 0, result: "a" }, { index: 1, result: "a" }, { index: 2, result: "a" }, { index: 3, result: "b" }, { index: 4, result: "b" }
  ]
)

testAggregate("cond:set", "test $cond with nested $set",
  input,
  [
    {
      $cond: [
        {
          index: { $lte: 2 }
        },
        {
          $set: {
            result: "a"
          }
        },
        {
          $set: {
            result: "b"
          }
        }
      ]
    }
  ],
  [
    { index: 0, result: "a" }, { index: 1, result: "a" }, { index: 2, result: "a" }, { index: 3, result: "b" }, { index: 4, result: "b" }
  ]
)

testQuery("gt(1),lt(3)", "test index === 2",
  new Array(5).fill(null).map((_, index) => ({ index })),
  {
    index: {
      $gt: 1,
      $lt: 3
    }
  },
  [
    { index: 2 }
  ]
)

testQuery("eq(2a)", "test index === reversed",
  new Array(5).fill(null).map((_, index) => ({ index, reversed: 4 - index })),
  {
    index: "$reversed"
  },
  [
    { index: 2, reversed: 2 }
  ]
)

testQuery("eq(2b)", "test index === $$redirect (= $reversed)",
  new Array(5).fill(null).map((_, index) => ({ index, reversed: 4 - index, redirect: "reversed" })),
  {
    $eq: ["$index", "$$redirect"]
  },
  [
    { index: 2, reversed: 2, redirect: "reversed" }
  ]
)

testQuery("eq(3)", "test index === $$redirect (= $reversed)",
  new Array(5).fill(null).map((_, index) => ({ index, reversed: 4 - index, redirect: "reversed" })),
  {
    index: "$$redirect"
  },
  [
    { index: 2, reversed: 2, redirect: "reversed" }
  ]
)

testQuery("eq(4)", "test index === $$redirect (= $reversed)",
  new Array(5).fill(null).map((_, index) => ({ index, reversed: 4 - index, redirect: "reversed" })),
  {
    index: "$$redirect"
  },
  [
    { index: 2, reversed: 2, redirect: "reversed" }
  ]
)


testQuery("nonnull(1)", "test $nonnull",
  [
    {
      test: null,
      blah: "test"
    }
  ],
  {
    $nonnull: ["$$blah", false]
  },
  [
    {
      test: null,
      blah: "test"
    }
  ]
)

testQuery("nonnull(2)", "test $nonnull inverted",
  [
    {
      test: null,
      blah: "test"
    }
  ],
  {
    $nonnull: ["$$blah", true]
  },
  [
  ]
);

testQuery("undefined", "test $nin with undefined",
  [1, 2, undefined, 4, null],
  {
    $nin: [null, undefined]
  },
  [1, 2, 4]
);

testAggregate("project(1)", "$set redirected var and $project (filter with 0)",
  [
    {
      number: 8,
      redirect: "number",
    }
  ],
  [
    {
      $set: {
        redirected: "$$redirect"
      }
    },
    {
      $project: {
        number: 0
      },
    }
  ],
  [
    {
      redirect: "number",
      redirected: 8
    }
  ]
)

testAggregate("project(2), alias(1)", "$addFields as alias of $set redirected var and $project (filter with 1)",
  [
    {
      number: 8,
      redirect: "number",
    }
  ],
  [
    {
      $addFields: {
        redirected: "$$redirect"
      }
    },
    {
      $project: {
        number: 1
      },
    }
  ],
  [
    {
      number: 8
    }
  ]
)

testAggregate("project:2", "$set value via $project",
  [
    {
      number: 8,
      redirect: "number",
    }
  ],
  [
    {
      $set: {
        redirected: "$$redirect"
      }
    },
    {
      $project: {
        number: 1
      },
    }
  ],
  [
    {
      number: 8
    }
  ]
)

input = {
  nested: {
    array: [1, 2, "b"]
  }
};

testAggregate("elemMatch", "testing elemMatch", [input], [{
  "nested.array": { $elemMatch: "b" }
}], [input]);

testAggregate("replaceRoot", "testing replaceRoot",
  [
    {
      nested: {
        array: [1, 2, "b"]
      }
    }
  ],
  [
    {
      $replaceRoot: { value: "newRoot" }
    }
  ],
  [
    {
      value: "newRoot"
    }
  ]
);

testAggregate("set(2)", "set bool result and array value",
  [
    {
      test: ["a", "b", 3]
    }
  ],
  [
    {
      $set: {
        bool: {
          $eq: [{ $size: "$test" }, 3]
        },
        elem: {
          $elemAt: ["$test", 1]
        }
      }
    }
  ],
  [
    {
      test: ["a", "b", 3],
      bool: true,
      elem: "b"
    }
  ]
);

testAggregate("set(3)", "test $set with lots of nesting, $mergeObjects, $min, $max, $sum, and $avg",
  [
    {
      ab3: ["a", "b", 3]
    }
  ],
  [
    {
      $set: {
        nested: {
          array: [1, 2, { $elemAt: ["$ab3", 2] }],
          second: [3, 4, {
            test: { $elemAt: ["$ab3", 1] },
            another: "test",
            third: {
              nested: ["blah", "blubber", { $size: "$ab3" }, {
                some: "array", last: {
                  level: "nested",
                  mergedNested: {
                    $mergeObjects: [
                      {
                        a: "a",
                        d: {
                          $eq: [{ $size: "$ab3" }, {
                            $size: {
                              $concat: [[
                                1, 2
                              ], 3]
                            }
                          }]
                        }
                      },
                      {
                        b: "b"
                      },
                      {
                        c: "c"
                      }
                    ]
                  }
                }
              }]
            }
          }, ["some", "array", { $size: "$ab3" }]]
        },
        min: { $min: "$nested.array" },
        max: { $max: "$nested.array" },
        sum: { $sum: "$nested.array" },
        avg: { $avg: "$nested.array" },
        elem: { $elemAt: ["$ab3", 1] },
        mergedFirst: "a",
        mergedSecond: "b"
      }
    }
  ],
  [
    {
      ab3: ["a", "b", 3],
      nested: {
        array: [1, 2, 3],
        second: [
          3, 4,
          {
            test: "b",
            another: "test",
            third: {
              nested: [
                "blah", "blubber", 3,
                {
                  some: "array",
                  last: {
                    level: "nested",
                    mergedNested: {
                      a: "a",
                      d: true,
                      b: "b",
                      c: "c"
                    }
                  }
                }
              ]
            }
          },
          ["some", "array", 3]
        ],
      },
      min: 1,
      max: 3,
      sum: 6,
      avg: 2,
      elem: "b",
      mergedFirst: "a",
      mergedSecond: "b"
    }
  ]
)

testAggregate("set(4)", "$set nested",
  [
    {}
  ],
  [
    {
      $set: {
        nested: {
          array: [1, 2, "b"],
          second: [3, 4, "c"]
        },
        mergedFirst: "a",
        mergedSecond: "b"
      }
    }
  ],
  [
    {
      nested: {
        array: [1, 2, "b"],
        second: [3, 4, "c"]
      },
      mergedFirst: "a",
      mergedSecond: "b"
    }
  ]
)


testAggregate("mergeObjects", "test merging three objects",
  [
    {}
  ],
  [
    {
      $set: {
        merged: {
          $mergeObjects: [
            {
              nested: {
                array: [1, 2, "b"],
                second: [3, 4, "c"]
              }
            },
            {
              mergedFirst: "a"
            },
            {
              mergedSecond: "b"
            }
          ]
        }
      }
    }
  ],
  [
    {
      merged: {
        nested: {
          array: [1, 2, "b"],
          second: [3, 4, "c"]
        },
        mergedFirst: "a",
        mergedSecond: "b"
      }
    }
  ]
);

input = [
  {
    test: "test",
    test2: "test2",
    test3: "test3"
  }
];

testAggregate("match", "match multiple fields",
  input,
  input,
  input
);

testAggregate("set(5)", "$set nested",
  [{ test: "blah" }],
  [{
    $set: {
      nested: {
        another: {
          array: [1, 2, "$test"]
        }
      }
    }
  }],
  [
    {
      test: "blah",
      nested: {
        another: {
          array: [1, 2, "blah"]
        }
      }
    }
  ]
)

testAggregate("mergeObjects(2)", "test $replaceRoot with $mergedObjects and $$ROOT",
  [
    {
      nested: {
        array: [1, 2, "b"]
      }
    }
  ],
  [
    {
      $replaceRoot: {
        $mergeObjects: [
          "$$ROOT",
          {
            mergedFirst: "a"
          },
          {
            mergedSecond: "b"
          }
        ]
      }
    }
  ],
  [
    {
      nested: {
        array: [1, 2, "b"]
      },
      mergedFirst: "a",
      mergedSecond: "b"
    }
  ]
)

testQuery("bitsAllSet(1)", "test bitsAllSet with $redirect",
  [
    {
      number: 9,
      redirect: "$number",
    }
  ],
  {
    redirect: { $bitsAllSet: 1 }
  },
  [
    {
      number: 9,
      redirect: "$number"
    }
  ]
)

testQuery("bitsAllClear(1)", "test bitsAllClear with $redirect",
  [
    {
      number: 8,
      redirect: "$number",
    }
  ],
  {
    redirect: { $bitsAllClear: 1 }
  },
  [
    {
      number: 8,
      redirect: "$number"
    }
  ]
);

testAggregate("arrayToObject", "test arrayToObject",
  [
    {
      test: [{ k: "1", v: 1 }, { k: "2", v: 2 }]
    }
  ],
  [{ $replaceRoot: { $arrayToObject: "$test" } }],
  [
    {
      "1": 1,
      "2": 2
    }
  ]
);

testAggregate("objectToArray", "test objectToArray",
  [{ "1": 1, "2": 2 }],
  [
    {
      $set: {
        test: { $objectToArray: "$$ROOT" }
      }
    },
    {
      $project: { test: 1 }
    }
  ],
  [
    {
      test: [{ k: "1", v: 1 }, { k: "2", v: 2 }]
    }
  ]
);


testAggregate("unwind", "test unwind",
  [
    { _id: 1, item: "Shirt", sizes: ["S", "M", "L"] },
    { _id: 2, item: "Shorts", sizes: [] },
    { _id: 3, item: "Hat", sizes: "M" },
    { _id: 4, item: "Gloves" },
    { _id: 5, item: "Scarf", sizes: null }
  ],
  [{ $unwind: { path: "$sizes" } }],
  [
    { _id: 1, item: "Shirt", sizes: "S" },
    { _id: 1, item: "Shirt", sizes: "M" },
    { _id: 1, item: "Shirt", sizes: "L" },
    { _id: 3, item: "Hat", sizes: "M" }
  ]
);

testAggregate("unwind:includeArrayIndex", "test unwind with includeArrayIndex = 'index'",
  [
    { _id: 1, item: "Shirt", sizes: ["S", "M", "L"] },
    { _id: 2, item: "Shorts", sizes: [] },
    { _id: 3, item: "Hat", sizes: "M" },
    { _id: 4, item: "Gloves" },
    { _id: 5, item: "Scarf", sizes: null }
  ],
  [{ $unwind: { path: "$sizes", includeArrayIndex: "index" } }],
  [
    { _id: 1, item: "Shirt", sizes: "S", index: 0 },
    { _id: 1, item: "Shirt", sizes: "M", index: 1 },
    { _id: 1, item: "Shirt", sizes: "L", index: 2 },
    { _id: 3, item: "Hat", sizes: "M" }
  ]
);

testAggregate("set(6)", "$set with $unwind",
  [
    { _id: 1, item: "Shirt", sizes: ["S", "M", "L"] },
    { _id: 2, item: "Shorts", sizes: [] },
    { _id: 3, item: "Hat", sizes: "M" },
    { _id: 4, item: "Gloves" },
    { _id: 5, item: "Scarf", sizes: null }
  ],
  [
    {
      $set: {
        test: {
          $unwind: {
            path: "$sizes", includeArrayIndex: "index"
          }
        }
      }
    },
    {
      $project: {
        test: 1
      }
    }
  ],
  [
    {
      test: [
        { _id: 1, item: "Shirt", sizes: "S", index: 0 },
        { _id: 1, item: "Shirt", sizes: "M", index: 1 },
        { _id: 1, item: "Shirt", sizes: "L", index: 2 }
      ]
    },
    {
      test: [
        { _id: 3, item: "Hat", sizes: "M" }
      ]
    }
  ]
);


testAggregate("unwind:preserveNullOrEmptyArrays", "test unwind with preserveNullOrEmptyArrays = true",
  [
    { _id: 1, item: "Shirt", sizes: ["S", "M", "L"] },
    { _id: 2, item: "Shorts", sizes: [] },
    { _id: 3, item: "Hat", sizes: "M" },
    { _id: 4, item: "Gloves" },
    { _id: 5, item: "Scarf", sizes: null }
  ],
  [{ $unwind: { path: "$sizes", preserveNullAndEmptyArrays: true } }],
  [
    { _id: 1, item: "Shirt", sizes: "S" },
    { _id: 1, item: "Shirt", sizes: "M" },
    { _id: 1, item: "Shirt", sizes: "L" },
    { _id: 2, item: "Shorts" },
    { _id: 3, item: "Hat", sizes: "M" },
    { _id: 4, item: "Gloves" },
    { _id: 5, item: "Scarf", sizes: null }
  ]
);

testAggregate("sort", "test $sort operator",
  new Array(10).fill(null).map((_, index) => ({ index })),
  [
    {
      $sort: {
        index: -1
      }
    }
  ],
  [
    { index: 9 },
    { index: 8 },
    { index: 7 },
    { index: 6 },
    { index: 5 },
    { index: 4 },
    { index: 3 },
    { index: 2 },
    { index: 1 },
    { index: 0 }
  ]
);

testAggregate("sort, skip, limit", "test skip and limit to return a subset of results",
  new Array(10).fill(null).map((_, index) => ({ index })),
  [
    {
      $sort: {
        index: -1
      }
    },
    {
      $skip: 5
    },
    {
      $limit: 3
    }
  ],
  [
    { index: 4 },
    { index: 3 },
    { index: 2 }
  ]
);

testQuery("", "",
  [
    {
      a: {
        s: new Date("2017-01-13T05:00:00.000Z"),
        e: new Date("2017-01-31T05:00:00.000Z"),
      },
    },
  ],
  {
    $and: [
      { "a.s": { $lte: new Date("2017-01-29T05:00:00.000Z") } },
      { "a.e": { $gte: new Date("2017-01-08T05:00:00.000Z") } },
    ],
  },
  [
    {
      a: {
        s: new Date("2017-01-13T05:00:00.000Z"),
        e: new Date("2017-01-31T05:00:00.000Z"),
      },
    },
  ],
);

testQuery("eq", "eq for nested null values, null != undefined",
  [{ field: [null] }, { field: null }],
  {
    "field.0": null
  },
  [{ field: [null] }]
);

testQuery("eq", "eq for null values, null != undefined",
  [
    { field: {} },
    { field: null },
    { field: { b: 0 } },
    { field: { b: null } },
  ],
  {
    "field.b": null,
  },
  [{ field: { b: null } }],
);

testAggregate("dateToString", "test dateToString",
  [
    {
      date1: new Date(`1976-12-27T12:34:56.000Z`),
      date2: `1976-12-27T12:34:56.000`
    },
  ],
  [
    {
      $set: {
        date1: { $dateToString: ["$date1", "%d.%m.%Y %H:%M:%S"] },
        date2: { $dateToString: ["$date2", "%y-%d-%m %H:%M:%S"] }
      }
    }
  ],
  [
    {
      date1: "27.12.1976 12:34:56",
      date2: "76-27-12 12:34:56"
    }
  ]
);

testAggregate("func(1)", "test custom functionality via the $func operator",
  [
    {
      data: "true"
    }
  ],
  [
    {
      $set: {
        data: {
          $func: (_context, _row, ..._args) => {
            logger.log("custom", "custom call via $func");
            return {
              trace: [],
              value: "false"
            }
          }
        }
      }
    }
  ],
  [
    {
      data: "false"
    }
  ]
);

testAggregate("func(2)", "test custom functionality via the $func operator. replace rows.",
  [
    {
      data: "true"
    }
  ],
  [
    {
      $func: (_context, _row, ..._args) => {
        logger.log("custom", "custom call via $func");
        return {
          trace: [],
          value: [{ row: "replaced" }],
          global: true
        }
      }
    }
  ],
  [
    {
      row: "replaced"
    }
  ]
);


// ─── $group ───────────────────────────────────────────────────────────────────

const groupInput = [
  { category: "a", price: 10, qty: 1, tag: "x" },
  { category: "a", price: 20, qty: 2, tag: "x" },
  { category: "b", price: 30, qty: 3, tag: "y" },
  { category: "b", price: 40, qty: 4, tag: "y" },
  { category: "b", price: 50, qty: 5, tag: "z" },
];

testAggregate("group:sum", "$group $sum",
  groupInput,
  [{ $group: { _id: "$category", total: { $sum: "$price" } } }],
  [
    { _id: "a", total: 30 },
    { _id: "b", total: 120 },
  ]
);

testAggregate("group:avg", "$group $avg",
  groupInput,
  [{ $group: { _id: "$category", avg: { $avg: "$price" } } }],
  [
    { _id: "a", avg: 15 },
    { _id: "b", avg: 40 },
  ]
);

testAggregate("group:min", "$group $min",
  groupInput,
  [{ $group: { _id: "$category", min: { $min: "$price" } } }],
  [
    { _id: "a", min: 10 },
    { _id: "b", min: 30 },
  ]
);

testAggregate("group:max", "$group $max",
  groupInput,
  [{ $group: { _id: "$category", max: { $max: "$price" } } }],
  [
    { _id: "a", max: 20 },
    { _id: "b", max: 50 },
  ]
);

testAggregate("group:push", "$group $push",
  groupInput,
  [{ $group: { _id: "$category", prices: { $push: "$price" } } }],
  [
    { _id: "a", prices: [10, 20] },
    { _id: "b", prices: [30, 40, 50] },
  ]
);

testAggregate("group:addToSet", "$group $addToSet deduplicates",
  groupInput,
  [{ $group: { _id: "$category", tags: { $addToSet: "$tag" } } }],
  [
    { _id: "a", tags: ["x"] },
    { _id: "b", tags: ["y", "z"] },
  ]
);

testAggregate("group:first", "$group $first",
  groupInput,
  [{ $group: { _id: "$category", first: { $first: "$price" } } }],
  [
    { _id: "a", first: 10 },
    { _id: "b", first: 30 },
  ]
);

testAggregate("group:last", "$group $last",
  groupInput,
  [{ $group: { _id: "$category", last: { $last: "$price" } } }],
  [
    { _id: "a", last: 20 },
    { _id: "b", last: 50 },
  ]
);

testAggregate("group:count", "$group $count",
  groupInput,
  [{ $group: { _id: "$category", n: { $count: "$price" } } }],
  [
    { _id: "a", n: 2 },
    { _id: "b", n: 3 },
  ]
);

testAggregate("group:null", "$group null _id (grand total)",
  groupInput,
  [{ $group: { _id: null, total: { $sum: "$price" } } }],
  [
    { _id: null, total: 150 },
  ]
);

testAggregate("group:combined", "$group multiple accumulators",
  groupInput,
  [{ $group: { _id: "$category", total: { $sum: "$price" }, avg: { $avg: "$qty" }, tags: { $addToSet: "$tag" }, n: { $count: "$price" } } }],
  [
    { _id: "a", total: 30, avg: 1.5, tags: ["x"], n: 2 },
    { _id: "b", total: 120, avg: 4, tags: ["y", "z"], n: 3 },
  ]
);

testAggregate("group:pipeline", "$group preceded by $match",
  groupInput,
  [
    { $match: { qty: { $gte: 3 } } },
    { $group: { _id: "$category", total: { $sum: "$price" }, n: { $count: "$price" } } },
  ],
  [
    { _id: "b", total: 120, n: 3 },
  ]
);

testAggregate("group:followed-by-sort", "$group then $sort",
  groupInput,
  [
    { $group: { _id: "$category", total: { $sum: "$price" } } },
    { $sort: { total: -1 } },
  ],
  [
    { _id: "b", total: 120 },
    { _id: "a", total: 30 },
  ]
);

testAggregate("group:followed-by-unwind", "$group $push then $unwind",
  groupInput,
  [
    { $group: { _id: "$category", prices: { $push: "$price" } } },
    { $unwind: "$prices" },
  ],
  [
    { _id: "a", prices: 10 },
    { _id: "a", prices: 20 },
    { _id: "b", prices: 30 },
    { _id: "b", prices: 40 },
    { _id: "b", prices: 50 },
  ]
);

testAggregate("group:followed-by-match", "$group then $match",
  groupInput,
  [
    { $group: { _id: "$category", total: { $sum: "$price" }, n: { $count: "$price" } } },
    { $match: { total: { $gt: 50 } } },
  ],
  [
    { _id: "b", total: 120, n: 3 },
  ]
);

testAggregate("group:followed-by-set", "$group then $set adds computed field",
  groupInput,
  [
    { $group: { _id: "$category", total: { $sum: "$price" }, n: { $count: "$price" } } },
    { $set: { avg: { $mul: [{ $sum: ["$total", 0] }, 1] } } },
  ],
  [
    { _id: "a", total: 30, n: 2, avg: 30 },
    { _id: "b", total: 120, n: 3, avg: 120 },
  ]
);

testAggregate("group:multi-stage", "$match $group $sort $limit",
  groupInput,
  [
    { $match: { qty: { $gte: 2 } } },
    { $group: { _id: "$category", total: { $sum: "$price" } } },
    { $sort: { total: -1 } },
    { $limit: 1 },
  ],
  [
    { _id: "b", total: 120 },
  ]
);

testAggregate("group:func", "$group $func custom accumulator (stdDevPop)",
  [
    { department: "eng",   score: 80 },
    { department: "eng",   score: 100 },
    { department: "eng",   score: 90 },
    { department: "sales", score: 60 },
    { department: "sales", score: 80 },
  ],
  [
    { $group: { _id: "$department", stdDev: { $func: (_ctx, groupRows) => {
      const values = groupRows.map(r => r.score);
      const mean = values.reduce((s, x) => s + x, 0) / values.length;
      const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
      return { value: Math.round(Math.sqrt(variance) * 100) / 100, trace: [] };
    } } } },
    { $sort: { _id: 1 } },
  ],
  [
    { _id: "eng",   stdDev: 8.16 },
    { _id: "sales", stdDev: 10 },
  ]
);

// ─── arithmetic ───────────────────────────────────────────────────────────────

const arithInput = [
  { a: 10, b: 3, x: -4.7 },
];

testAggregate("arith:add", "$add",
  arithInput,
  [{ $set: { r: { $add: ["$a", "$b"] } } }],
  [{ a: 10, b: 3, x: -4.7, r: 13 }]
);

testAggregate("arith:subtract", "$subtract",
  arithInput,
  [{ $set: { r: { $subtract: ["$a", "$b"] } } }],
  [{ a: 10, b: 3, x: -4.7, r: 7 }]
);

testAggregate("arith:divide", "$divide",
  arithInput,
  [{ $set: { r: { $divide: ["$a", "$b"] } } }],
  [{ a: 10, b: 3, x: -4.7, r: 10 / 3 }]
);

testAggregate("arith:mod", "$mod",
  arithInput,
  [{ $set: { r: { $mod: ["$a", "$b"] } } }],
  [{ a: 10, b: 3, x: -4.7, r: 1 }]
);

testAggregate("arith:pow", "$pow",
  arithInput,
  [{ $set: { r: { $pow: ["$a", "$b"] } } }],
  [{ a: 10, b: 3, x: -4.7, r: 1000 }]
);

testAggregate("arith:abs", "$abs",
  arithInput,
  [{ $set: { r: { $abs: "$x" } } }],
  [{ a: 10, b: 3, x: -4.7, r: 4.7 }]
);

testAggregate("arith:ceil", "$ceil",
  arithInput,
  [{ $set: { r: { $ceil: "$x" } } }],
  [{ a: 10, b: 3, x: -4.7, r: -4 }]
);

testAggregate("arith:floor", "$floor",
  arithInput,
  [{ $set: { r: { $floor: "$x" } } }],
  [{ a: 10, b: 3, x: -4.7, r: -5 }]
);

testAggregate("arith:round(0)", "$round to integer",
  arithInput,
  [{ $set: { r: { $round: "$x" } } }],
  [{ a: 10, b: 3, x: -4.7, r: -5 }]
);

testAggregate("arith:round(1)", "$round to 1 decimal place",
  arithInput,
  [{ $set: { r: { $round: ["$x", 1] } } }],
  [{ a: 10, b: 3, x: -4.7, r: -4.7 }]
);

// combinations

testAggregate("arith:add+mul", "$add result fed into $mul",
  arithInput,
  [{ $set: { r: { $mul: [{ $add: ["$a", "$b"] }, 2] } } }],
  [{ a: 10, b: 3, x: -4.7, r: 26 }]
);

testAggregate("arith:divide+round", "$divide then $round",
  arithInput,
  [{ $set: { r: { $round: [{ $divide: ["$a", "$b"] }, 2] } } }],
  [{ a: 10, b: 3, x: -4.7, r: 3.33 }]
);

testAggregate("arith:abs+ceil", "$abs then $ceil (no-op on positive)",
  arithInput,
  [{ $set: { r: { $ceil: { $abs: "$x" } } } }],
  [{ a: 10, b: 3, x: -4.7, r: 5 }]
);

testAggregate("arith:pow+subtract", "$pow then $subtract",
  arithInput,
  [{ $set: { r: { $subtract: [{ $pow: ["$a", 2] }, { $pow: ["$b", 2] }] } } }],
  [{ a: 10, b: 3, x: -4.7, r: 91 }]
);

testAggregate("arith:group+divide", "$group $sum then $divide for manual avg",
  groupInput,
  [
    { $group: { _id: "$category", total: { $sum: "$price" }, n: { $count: "$price" } } },
    { $set: { avg: { $divide: ["$total", "$n"] } } },
  ],
  [
    { _id: "a", total: 30, n: 2, avg: 15 },
    { _id: "b", total: 120, n: 3, avg: 40 },
  ]
);

testQuery("arith:match-expr", "$gt on computed $add in query",
  [{ a: 10, b: 3 }, { a: 2, b: 1 }],
  { $eq: [{ $add: ["$a", "$b"] }, 13] },
  [{ a: 10, b: 3 }]
);

// ─── string operators ─────────────────────────────────────────────────────────

const strInput = [
  { name: "  Alice  ", role: "Admin", score: 42, tags: ["a", "b"] },
];

testAggregate("str:toLower", "$toLower",
  strInput,
  [{ $set: { r: { $toLower: "$role" } } }],
  [{ ...strInput[0], r: "admin" }]
);

testAggregate("str:toUpper", "$toUpper",
  strInput,
  [{ $set: { r: { $toUpper: "$role" } } }],
  [{ ...strInput[0], r: "ADMIN" }]
);

testAggregate("str:toString", "$toString on number",
  strInput,
  [{ $set: { r: { $toString: "$score" } } }],
  [{ ...strInput[0], r: "42" }]
);

testAggregate("str:strLen", "$strLen",
  strInput,
  [{ $set: { r: { $strLen: "$role" } } }],
  [{ ...strInput[0], r: 5 }]
);

testAggregate("str:substr", "$substr start+length",
  strInput,
  [{ $set: { r: { $substr: ["$role", 1, 3] } } }],
  [{ ...strInput[0], r: "dmi" }]
);

testAggregate("str:substr:noLength", "$substr start only",
  strInput,
  [{ $set: { r: { $substr: ["$role", 2, -1] } } }],
  [{ ...strInput[0], r: "min" }]
);

testAggregate("str:split", "$split",
  [{ path: "a/b/c" }],
  [{ $set: { parts: { $split: ["$path", "/"] } } }],
  [{ path: "a/b/c", parts: ["a", "b", "c"] }]
);

testAggregate("str:trim", "$trim whitespace",
  strInput,
  [{ $set: { r: { $trim: "$name" } } }],
  [{ ...strInput[0], r: "Alice" }]
);

testAggregate("str:trim:chars", "$trim custom chars",
  [{ s: "***hello***" }],
  [{ $set: { r: { $trim: ["$s", "*"] } } }],
  [{ s: "***hello***", r: "hello" }]
);

testAggregate("str:ltrim", "$ltrim whitespace",
  strInput,
  [{ $set: { r: { $ltrim: "$name" } } }],
  [{ ...strInput[0], r: "Alice  " }]
);

testAggregate("str:rtrim", "$rtrim whitespace",
  strInput,
  [{ $set: { r: { $rtrim: "$name" } } }],
  [{ ...strInput[0], r: "  Alice" }]
);

testAggregate("str:indexOf:found", "$indexOf found",
  strInput,
  [{ $set: { r: { $indexOf: ["$role", "dm"] } } }],
  [{ ...strInput[0], r: 1 }]
);

testAggregate("str:indexOf:missing", "$indexOf not found returns -1",
  strInput,
  [{ $set: { r: { $indexOf: ["$role", "xyz"] } } }],
  [{ ...strInput[0], r: -1 }]
);

testAggregate("str:strConcat", "$strConcat joins array of strings",
  strInput,
  [{ $set: { r: { $strConcat: [["Hello, ", "$role", "!"]] } } }],
  [{ ...strInput[0], r: "Hello, Admin!" }]
);

testAggregate("str:concatArrays", "$concatArrays alias works",
  strInput,
  [{ $set: { r: { $concatArrays: ["$tags", ["c"]] } } }],
  [{ ...strInput[0], r: ["a", "b", "c"] }]
);

// combinations

testAggregate("str:trim+toUpper", "$trim then $toUpper",
  strInput,
  [{ $set: { r: { $toUpper: { $trim: "$name" } } } }],
  [{ ...strInput[0], r: "ALICE" }]
);

testAggregate("str:split+size", "$split then $size",
  [{ path: "a/b/c" }],
  [{ $set: { n: { $size: { $split: ["$path", "/"] } } } }],
  [{ path: "a/b/c", n: 3 }]
);

testAggregate("str:toString+strLen", "$toString then $strLen",
  strInput,
  [{ $set: { r: { $strLen: { $toString: "$score" } } } }],
  [{ ...strInput[0], r: 2 }]
);

testAggregate("str:group+toLower", "$group _id normalized with $toLower",
  [{ cat: "A", v: 1 }, { cat: "a", v: 2 }, { cat: "B", v: 3 }],
  [{ $group: { _id: { $toLower: "$cat" }, total: { $sum: "$v" } } }],
  [
    { _id: "a", total: 3 },
    { _id: "b", total: 3 },
  ]
);

testQuery("str:match-indexOf", "filter where substring present",
  [{ name: "Alice" }, { name: "Bob" }, { name: "Alberta" }],
  { $gt: [{ $indexOf: ["$name", "Al"] }, -1] },
  [{ name: "Alice" }, { name: "Alberta" }]
);

// ─── array expressions ────────────────────────────────────────────────────────

const arrInput = [
  { nums: [1, 2, 3, 4, 5], words: ["foo", "bar", "baz"], nested: [[1, 2], [3, 4]] },
];

testAggregate("arr:filter", "$filter even numbers",
  arrInput,
  [{ $set: { r: { $filter: { input: "$nums", as: "n", cond: { $eq: [{ $mod: ["$n", 2] }, 0] } } } } }],
  [{ ...arrInput[0], r: [2, 4] }]
);

testAggregate("arr:map", "$map doubles each element",
  arrInput,
  [{ $set: { r: { $map: { input: "$nums", as: "n", in: { $mul: ["$n", 2] } } } } }],
  [{ ...arrInput[0], r: [2, 4, 6, 8, 10] }]
);

testAggregate("arr:reduce", "$reduce sums array",
  arrInput,
  [{ $set: { r: { $reduce: { input: "$nums", initialValue: 0, in: { $add: ["$value", "$this"] } } } } }],
  [{ ...arrInput[0], r: 15 }]
);

testAggregate("arr:reduce:concat", "$reduce builds string",
  arrInput,
  [{ $set: { r: { $reduce: { input: "$words", initialValue: "", in: { $strConcat: [["$value", "$this", ","]] } } } } }],
  [{ ...arrInput[0], r: "foo,bar,baz," }]
);

testAggregate("arr:slice:count", "$slice first N",
  arrInput,
  [{ $set: { r: { $slice: ["$nums", 3] } } }],
  [{ ...arrInput[0], r: [1, 2, 3] }]
);

testAggregate("arr:slice:negative", "$slice last N",
  arrInput,
  [{ $set: { r: { $slice: ["$nums", -2] } } }],
  [{ ...arrInput[0], r: [4, 5] }]
);

testAggregate("arr:slice:start+count", "$slice start + count",
  arrInput,
  [{ $set: { r: { $slice: ["$nums", 1, 3] } } }],
  [{ ...arrInput[0], r: [2, 3, 4] }]
);

testAggregate("arr:reverseArray", "$reverseArray",
  arrInput,
  [{ $set: { r: { $reverseArray: "$nums" } } }],
  [{ ...arrInput[0], r: [5, 4, 3, 2, 1] }]
);

testAggregate("arr:range:basic", "$range basic",
  arrInput,
  [{ $set: { r: { $range: [1, 5] } } }],
  [{ ...arrInput[0], r: [1, 2, 3, 4] }]
);

testAggregate("arr:range:step", "$range with step",
  arrInput,
  [{ $set: { r: { $range: [0, 10, 3] } } }],
  [{ ...arrInput[0], r: [0, 3, 6, 9] }]
);

testAggregate("arr:range:negative-step", "$range descending",
  arrInput,
  [{ $set: { r: { $range: [5, 0, -1] } } }],
  [{ ...arrInput[0], r: [5, 4, 3, 2, 1] }]
);

testAggregate("arr:indexOfArray:found", "$indexOfArray found",
  arrInput,
  [{ $set: { r: { $indexOfArray: ["$nums", 3] } } }],
  [{ ...arrInput[0], r: 2 }]
);

testAggregate("arr:indexOfArray:missing", "$indexOfArray not found",
  arrInput,
  [{ $set: { r: { $indexOfArray: ["$nums", 99] } } }],
  [{ ...arrInput[0], r: -1 }]
);

testAggregate("arr:flatten:depth1", "$flatten depth 1",
  arrInput,
  [{ $set: { r: { $flatten: "$nested" } } }],
  [{ ...arrInput[0], r: [1, 2, 3, 4] }]
);

testAggregate("arr:flatten:depth2", "$flatten deep",
  [{ nested: [[1, [2, 3]], [4]] }],
  [{ $set: { r: { $flatten: ["$nested", 2] } } }],
  [{ nested: [[1, [2, 3]], [4]], r: [1, 2, 3, 4] }]
);

// combinations

testAggregate("arr:map+filter", "$map then $filter",
  arrInput,
  [{ $set: { r: { $filter: { input: { $map: { input: "$nums", as: "n", in: { $mul: ["$n", 2] } } }, as: "n", cond: { $gt: ["$n", 6] } } } } }],
  [{ ...arrInput[0], r: [8, 10] }]
);

testAggregate("arr:reduce+size", "$reduce to build array then $size",
  arrInput,
  [{ $set: { r: { $size: { $filter: { input: "$nums", as: "n", cond: { $gt: ["$n", 2] } } } } } }],
  [{ ...arrInput[0], r: 3 }]
);

testAggregate("arr:range+map", "$range then $map squares",
  arrInput,
  [{ $set: { r: { $map: { input: { $range: [1, 5] }, as: "n", in: { $pow: ["$n", 2] } } } } }],
  [{ ...arrInput[0], r: [1, 4, 9, 16] }]
);

testAggregate("arr:reverseArray+elemAt", "$reverseArray then $elemAt gets last",
  arrInput,
  [{ $set: { r: { $elemAt: [{ $reverseArray: "$nums" }, 0] } } }],
  [{ ...arrInput[0], r: 5 }]
);

testAggregate("arr:group+map", "$group then $map on pushed array",
  groupInput,
  [
    { $group: { _id: "$category", prices: { $push: "$price" } } },
    { $set: { doubled: { $map: { input: "$prices", as: "p", in: { $mul: ["$p", 2] } } } } },
  ],
  [
    { _id: "a", prices: [10, 20], doubled: [20, 40] },
    { _id: "b", prices: [30, 40, 50], doubled: [60, 80, 100] },
  ]
);

testQuery("arr:filter-match", "filter rows where any num > 3",
  [{ nums: [1, 2, 3] }, { nums: [4, 5] }, { nums: [1] }],
  { $gt: [{ $size: { $filter: { input: "$nums", as: "n", cond: { $gt: ["$n", 3] } } } }, 0] },
  [{ nums: [4, 5] }]
);

// ─── $nor / $all ──────────────────────────────────────────────────────────────

testQuery("nor:basic", "$nor excludes all matching",
  [{ a: 1 }, { a: 2 }, { a: 3 }],
  { $nor: [{ $eq: ["$a", 1] }, { $eq: ["$a", 2] }] },
  [{ a: 3 }]
);

testQuery("all:basic", "$all array contains all values",
  [{ tags: ["a", "b", "c"] }, { tags: ["a", "c"] }, { tags: ["b"] }],
  { $all: ["$tags", ["a", "b"]] },
  [{ tags: ["a", "b", "c"] }]
);

testQuery("nor+all:combined", "$nor with $all",
  [{ tags: ["a", "b"] }, { tags: ["a"] }, { tags: ["c"] }],
  { $nor: [{ $all: ["$tags", ["a", "b"]] }] },
  [{ tags: ["a"] }, { tags: ["c"] }]
);

// ─── $switch ──────────────────────────────────────────────────────────────────

testAggregate("switch:basic", "$switch branches",
  [{ score: 90 }, { score: 70 }, { score: 40 }],
  [{ $set: { grade: { $switch: { branches: [{ case: { $gte: ["$score", 80] }, then: "A" }, { case: { $gte: ["$score", 60] }, then: "B" }], default: "F" } } } }],
  [{ score: 90, grade: "A" }, { score: 70, grade: "B" }, { score: 40, grade: "F" }]
);

testAggregate("switch:combined", "$switch with arithmetic",
  [{ x: 3 }, { x: -3 }],
  [{ $set: { r: { $switch: { branches: [{ case: { $gt: ["$x", 0] }, then: { $sqrt: "$x" } }], default: { $abs: "$x" } } } } }],
  [{ x: 3, r: Math.sqrt(3) }, { x: -3, r: 3 }]
);

// ─── $unset / $replaceWith / $count ───────────────────────────────────────────

testAggregate("unset:basic", "$unset removes field",
  [{ a: 1, b: 2, c: 3 }],
  [{ $unset: "b" }],
  [{ a: 1, c: 3 }]
);

testAggregate("unset:multiple", "$unset removes multiple fields",
  [{ a: 1, b: 2, c: 3 }],
  [{ $unset: ["a", "b"] }],
  [{ c: 3 }]
);

testAggregate("replaceWith:basic", "$replaceWith alias",
  [{ a: 1, nested: { x: 10 } }],
  [{ $replaceWith: "$nested" }],
  [{ x: 10 }]
);

testAggregate("count:basic", "$count stage",
  [{ a: 1 }, { a: 2 }, { a: 3 }],
  [{ $count: "total" }],
  [{ total: 3 }]
);

testAggregate("count:combined", "$match then $count",
  [{ a: 1 }, { a: 2 }, { a: 3 }],
  [{ $match: { a: { $gt: 1 } } }, { $count: "total" }],
  [{ total: 2 }]
);

testAggregate("match:bare-expr", "$match with bare expression (field-to-field)",
  [{ a: 5, b: 3 }, { a: 1, b: 3 }, { a: 3, b: 3 }],
  [{ $match: { $gt: ["$a", "$b"] } }],
  [{ a: 5, b: 3 }]
);

testQuery("match:bare-expr-query", "Query with bare expression",
  [{ a: 5, b: 3 }, { a: 1, b: 3 }],
  { $gt: ["$a", "$b"] },
  [{ a: 5, b: 3 }]
);

// ─── bitwise $bitsAnySet / $bitsAnyClear ──────────────────────────────────────

testQuery("bitsAnySet:basic", "$bitsAnySet",
  [{ flags: 0b1010 }, { flags: 0b0100 }, { flags: 0b0000 }],
  { $bitsAnySet: ["$flags", 0b0011] },
  [{ flags: 0b1010 }]
);

testQuery("bitsAnyClear:basic", "$bitsAnyClear",
  [{ flags: 0b1111 }, { flags: 0b1110 }],
  { $bitsAnyClear: ["$flags", 0b0001] },
  [{ flags: 0b1110 }]
);

// ─── math: $sqrt $trunc $exp $ln $log $log10 ──────────────────────────────────

testAggregate("math:sqrt", "$sqrt",
  [{ x: 9 }],
  [{ $set: { r: { $sqrt: "$x" } } }],
  [{ x: 9, r: 3 }]
);

testAggregate("math:trunc", "$trunc",
  [{ x: 4.9 }],
  [{ $set: { r: { $trunc: "$x" } } }],
  [{ x: 4.9, r: 4 }]
);

testAggregate("math:trunc:places", "$trunc with decimal places",
  [{ x: 4.567 }],
  [{ $set: { r: { $trunc: ["$x", 2] } } }],
  [{ x: 4.567, r: 4.56 }]
);

testAggregate("math:exp", "$exp",
  [{ x: 1 }],
  [{ $set: { r: { $exp: "$x" } } }],
  [{ x: 1, r: Math.E }]
);

testAggregate("math:ln", "$ln",
  [{ x: Math.E }],
  [{ $set: { r: { $ln: "$x" } } }],
  [{ x: Math.E, r: 1 }]
);

testAggregate("math:log", "$log base 2",
  [{ x: 8 }],
  [{ $set: { r: { $log: ["$x", 2] } } }],
  [{ x: 8, r: 3 }]
);

testAggregate("math:log10", "$log10",
  [{ x: 1000 }],
  [{ $set: { r: { $log10: "$x" } } }],
  [{ x: 1000, r: 3 }]
);

testAggregate("math:sqrt+pow:combined", "$sqrt of $pow",
  [{ x: 4 }],
  [{ $set: { r: { $sqrt: { $pow: ["$x", 2] } } } }],
  [{ x: 4, r: 4 }]
);

testAggregate("math:log+exp:combined", "$ln($exp(x)) === x",
  [{ x: 5 }],
  [{ $set: { r: { $ln: { $exp: "$x" } } } }],
  [{ x: 5, r: 5 }]
);

// ─── string: $regexFind $regexFindAll $replaceOne $replaceAll ────────────────

testAggregate("str:regexFind:found", "$regexFind returns match object",
  [{ s: "foo123bar" }],
  [{ $set: { r: { $regexFind: ["$s", "\\d+"] } } }],
  [{ s: "foo123bar", r: { match: "123", idx: 3, captures: [] } }]
);

testAggregate("str:regexFind:notfound", "$regexFind returns null when no match",
  [{ s: "foobar" }],
  [{ $set: { r: { $regexFind: ["$s", "\\d+"] } } }],
  [{ s: "foobar", r: null }]
);

testAggregate("str:regexFindAll", "$regexFindAll returns all matches",
  [{ s: "a1b2c3" }],
  [{ $set: { r: { $regexFindAll: ["$s", "\\d"] } } }],
  [{ s: "a1b2c3", r: [{ match: "1", idx: 1, captures: [] }, { match: "2", idx: 3, captures: [] }, { match: "3", idx: 5, captures: [] }] }]
);

testAggregate("str:replaceOne", "$replaceOne replaces first occurrence",
  [{ s: "aabbaa" }],
  [{ $set: { r: { $replaceOne: ["$s", "a", "x"] } } }],
  [{ s: "aabbaa", r: "xabbaa" }]
);

testAggregate("str:replaceAll", "$replaceAll replaces all occurrences",
  [{ s: "aabbaa" }],
  [{ $set: { r: { $replaceAll: ["$s", "a", "x"] } } }],
  [{ s: "aabbaa", r: "xxbbxx" }]
);

testAggregate("str:replaceAll+toLower:combined", "$replaceAll then $toLower",
  [{ s: "Hello World" }],
  [{ $set: { r: { $toLower: { $replaceAll: ["$s", " ", "_"] } } } }],
  [{ s: "Hello World", r: "hello_world" }]
);

// ─── array: $sortArray $zip ───────────────────────────────────────────────────

testAggregate("arr:sortArray:asc", "$sortArray ascending primitives",
  [{ nums: [3, 1, 4, 1, 5] }],
  [{ $set: { r: { $sortArray: { input: "$nums", sortBy: 1 } } } }],
  [{ nums: [3, 1, 4, 1, 5], r: [1, 1, 3, 4, 5] }]
);

testAggregate("arr:sortArray:desc", "$sortArray descending primitives",
  [{ nums: [3, 1, 4, 1, 5] }],
  [{ $set: { r: { $sortArray: { input: "$nums", sortBy: -1 } } } }],
  [{ nums: [3, 1, 4, 1, 5], r: [5, 4, 3, 1, 1] }]
);

testAggregate("arr:sortArray:obj", "$sortArray by object field",
  [{ items: [{ n: 3 }, { n: 1 }, { n: 2 }] }],
  [{ $set: { r: { $sortArray: { input: "$items", sortBy: { n: 1 } } } } }],
  [{ items: [{ n: 3 }, { n: 1 }, { n: 2 }], r: [{ n: 1 }, { n: 2 }, { n: 3 }] }]
);

testAggregate("arr:zip:basic", "$zip transposes arrays",
  [{ a: [1, 2, 3], b: ["x", "y", "z"] }],
  [{ $set: { r: { $zip: { inputs: ["$a", "$b"] } } } }],
  [{ a: [1, 2, 3], b: ["x", "y", "z"], r: [[1, "x"], [2, "y"], [3, "z"]] }]
);

testAggregate("arr:zip:useLongest", "$zip useLongestLength with defaults",
  [{ a: [1, 2, 3], b: ["x"] }],
  [{ $set: { r: { $zip: { inputs: ["$a", "$b"], useLongestLength: true, defaults: [0, "?"] } } } }],
  [{ a: [1, 2, 3], b: ["x"], r: [[1, "x"], [2, "?"], [3, "?"]] }]
);

testAggregate("arr:zip+map:combined", "$zip then $map to extract first elements",
  [{ a: [1, 2, 3], b: ["x", "y", "z"] }],
  [{ $set: { r: { $map: { input: { $zip: { inputs: ["$a", "$b"] } }, as: "pair", in: { $elemAt: ["$pair", 0] } } } } }],
  [{ a: [1, 2, 3], b: ["x", "y", "z"], r: [1, 2, 3] }]
);

// ─── type operators ───────────────────────────────────────────────────────────

testAggregate("type:isArray", "$isArray",
  [{ a: [1, 2], b: 3 }],
  [{ $set: { r1: { $isArray: "$a" }, r2: { $isArray: "$b" } } }],
  [{ a: [1, 2], b: 3, r1: true, r2: false }]
);

testAggregate("type:isNumber", "$isNumber",
  [{ a: 42, b: "hello" }],
  [{ $set: { r1: { $isNumber: "$a" }, r2: { $isNumber: "$b" } } }],
  [{ a: 42, b: "hello", r1: true, r2: false }]
);

testAggregate("type:isString", "$isString",
  [{ a: "hi", b: 1 }],
  [{ $set: { r1: { $isString: "$a" }, r2: { $isString: "$b" } } }],
  [{ a: "hi", b: 1, r1: true, r2: false }]
);

testAggregate("type:isObject", "$isObject",
  [{ a: { x: 1 }, b: [1] }],
  [{ $set: { r1: { $isObject: "$a" }, r2: { $isObject: "$b" } } }],
  [{ a: { x: 1 }, b: [1], r1: true, r2: false }]
);

testAggregate("type:type", "$type returns type string",
  [{ a: 1, b: "hi", c: [1], d: null }],
  [{ $set: { t1: { $type: "$a" }, t2: { $type: "$b" }, t3: { $type: "$c" }, t4: { $type: "$d" } } }],
  [{ a: 1, b: "hi", c: [1], d: null, t1: "number", t2: "string", t3: "array", t4: "null" }]
);

testAggregate("type:toInt", "$toInt from string",
  [{ s: "42" }],
  [{ $set: { r: { $toInt: "$s" } } }],
  [{ s: "42", r: 42 }]
);

testAggregate("type:toDouble", "$toDouble from string",
  [{ s: "3.14" }],
  [{ $set: { r: { $toDouble: "$s" } } }],
  [{ s: "3.14", r: 3.14 }]
);

testAggregate("type:toBool", "$toBool from various types",
  [{ a: 1, b: 0, c: "true", d: "false" }],
  [{ $set: { r1: { $toBool: "$a" }, r2: { $toBool: "$b" }, r3: { $toBool: "$c" }, r4: { $toBool: "$d" } } }],
  [{ a: 1, b: 0, c: "true", d: "false", r1: true, r2: false, r3: true, r4: false }]
);

testAggregate("type:toDate", "$toDate from string",
  [{ s: "2024-01-15T00:00:00.000Z" }],
  [{ $set: { r: { $toDate: "$s" } } }],
  [{ s: "2024-01-15T00:00:00.000Z", r: new Date("2024-01-15T00:00:00.000Z") }]
);

testAggregate("type:cond+isArray:combined", "$cond with $isArray guard",
  [{ a: [1, 2] }, { a: 5 }],
  [{ $set: { r: { $cond: [{ $isArray: "$a" }, { $size: "$a" }, 0] } } }],
  [{ a: [1, 2], r: 2 }, { a: 5, r: 0 }]
);

// ─── date extractors ──────────────────────────────────────────────────────────

const testDate = new Date("2024-03-15T10:30:45.123Z");
const dateInput = [{ d: testDate }];

testAggregate("date:year", "$year",
  dateInput,
  [{ $set: { r: { $year: "$d" } } }],
  [{ d: testDate, r: 2024 }]
);

testAggregate("date:month", "$month",
  dateInput,
  [{ $set: { r: { $month: "$d" } } }],
  [{ d: testDate, r: 3 }]
);

testAggregate("date:dayOfMonth", "$dayOfMonth",
  dateInput,
  [{ $set: { r: { $dayOfMonth: "$d" } } }],
  [{ d: testDate, r: 15 }]
);

testAggregate("date:dayOfWeek", "$dayOfWeek (1=Sun)",
  dateInput,
  [{ $set: { r: { $dayOfWeek: "$d" } } }],
  [{ d: testDate, r: 6 }]
);

testAggregate("date:isoDayOfWeek", "$isoDayOfWeek (1=Mon)",
  dateInput,
  [{ $set: { r: { $isoDayOfWeek: "$d" } } }],
  [{ d: testDate, r: 5 }]
);

testAggregate("date:hour", "$hour",
  dateInput,
  [{ $set: { r: { $hour: "$d" } } }],
  [{ d: testDate, r: 10 }]
);

testAggregate("date:minute", "$minute",
  dateInput,
  [{ $set: { r: { $minute: "$d" } } }],
  [{ d: testDate, r: 30 }]
);

testAggregate("date:second", "$second",
  dateInput,
  [{ $set: { r: { $second: "$d" } } }],
  [{ d: testDate, r: 45 }]
);

testAggregate("date:millisecond", "$millisecond",
  dateInput,
  [{ $set: { r: { $millisecond: "$d" } } }],
  [{ d: testDate, r: 123 }]
);

testAggregate("date:dateFromString", "$dateFromString",
  [{ s: "2024-03-15T10:30:45.123Z" }],
  [{ $set: { r: { $dateFromString: "$s" } } }],
  [{ s: "2024-03-15T10:30:45.123Z", r: testDate }]
);

testAggregate("date:dateAdd", "$dateAdd 7 days",
  dateInput,
  [{ $set: { r: { $dateAdd: { startDate: "$d", amount: 7, unit: "day" } } } }],
  [{ d: testDate, r: new Date("2024-03-22T10:30:45.123Z") }]
);

testAggregate("date:dateSubtract", "$dateSubtract 1 hour",
  dateInput,
  [{ $set: { r: { $dateSubtract: { startDate: "$d", amount: 1, unit: "hour" } } } }],
  [{ d: testDate, r: new Date("2024-03-15T09:30:45.123Z") }]
);

testAggregate("date:dateDiff", "$dateDiff in days",
  [{ start: new Date("2024-01-01"), end: new Date("2024-01-11") }],
  [{ $set: { r: { $dateDiff: { startDate: "$start", endDate: "$end", unit: "day" } } } }],
  [{ start: new Date("2024-01-01"), end: new Date("2024-01-11"), r: 10 }]
);

testAggregate("date:year+month:combined", "$year and $month for grouping",
  [
    { d: new Date("2024-01-10"), v: 10 },
    { d: new Date("2024-01-20"), v: 20 },
    { d: new Date("2024-02-05"), v: 5 },
  ],
  [
    { $group: { _id: { year: { $year: "$d" }, month: { $month: "$d" } }, total: { $sum: "$v" } } },
    { $sort: { "_id.month": 1 } },
  ],
  [
    { _id: { year: 2024, month: 1 }, total: 30 },
    { _id: { year: 2024, month: 2 }, total: 5 },
  ]
);

testAggregate("date:dateAdd+dateToString:combined", "$dateAdd then $dateToString",
  dateInput,
  [{ $set: { r: { $dateToString: [{ $dateAdd: { startDate: "$d", amount: 1, unit: "day" } }, "%Y-%m-%d"] } } }],
  [{ d: testDate, r: "2024-03-16" }]
);

// ─── $first ───────────────────────────────────────────────────────────────────

testAggregate("first:positive", "$first positive n returns first n elements",
  [{ nums: [1, 2, 3, 4, 5] }],
  [{ $set: { r: { $first: ["$nums", 3] } } }],
  [{ nums: [1, 2, 3, 4, 5], r: [1, 2, 3] }]
);

testAggregate("first:negative", "$first negative n returns last n elements",
  [{ nums: [1, 2, 3, 4, 5] }],
  [{ $set: { r: { $first: ["$nums", -2] } } }],
  [{ nums: [1, 2, 3, 4, 5], r: [4, 5] }]
);

testAggregate("first:zero", "$first zero returns empty array",
  [{ nums: [1, 2, 3] }],
  [{ $set: { r: { $first: ["$nums", 0] } } }],
  [{ nums: [1, 2, 3], r: [] }]
);

testAggregate("first:combined", "$first then $sum",
  [{ nums: [10, 20, 30, 40, 50] }],
  [{ $set: { r: { $sum: { $first: ["$nums", 3] } } } }],
  [{ nums: [10, 20, 30, 40, 50], r: 60 }]
);

testAggregate("first:combined-negative", "$first negative then $size",
  [{ nums: [1, 2, 3, 4, 5] }],
  [{ $set: { r: { $size: { $first: ["$nums", -3] } } } }],
  [{ nums: [1, 2, 3, 4, 5], r: 3 }]
);

// ─── $let ─────────────────────────────────────────────────────────────────────

testAggregate("let:basic", "$let binds variable used in expression",
  [{ a: 3, b: 4 }],
  [{ $set: { r: { $let: { vars: { t: { $add: ["$a", "$b"] } }, in: { $mul: ["_$t", "_$t"] } } } } }],
  [{ a: 3, b: 4, r: 49 }]
);

testAggregate("let:multiple-vars", "$let binds multiple variables",
  [{ x: 2 }],
  [{ $set: { r: { $let: { vars: { a: { $mul: ["$x", 3] }, b: { $add: ["$x", 1] } }, in: { $add: ["_$a", "_$b"] } } } } }],
  [{ x: 2, r: 9 }]
);

testAggregate("let:nested", "$let nested within $map",
  [{ nums: [1, 2, 3] }],
  [{ $set: { r: { $map: { input: "$nums", as: "n", in: { $let: { vars: { squared: { $pow: ["$n", 2] } }, in: { $add: ["_$squared", 1] } } } } } } }],
  [{ nums: [1, 2, 3], r: [2, 5, 10] }]
);

testAggregate("let:scope", "$let vars do not leak outside expression",
  [{ a: 5 }],
  [
    { $set: { r: { $let: { vars: { t: 99 }, in: "_$t" } } } },
    { $set: { leaked: "_$t" } }
  ],
  [{ a: 5, r: 99 }]
);

// ─── $lookup ──────────────────────────────────────────────────────────────────

const orders = [
  { orderId: 1, customerId: 10, total: 100 },
  { orderId: 2, customerId: 20, total: 200 },
  { orderId: 3, customerId: 10, total: 50 },
];

const customers = [
  { id: 10, name: "Alice" },
  { id: 20, name: "Bob" },
];

testAggregate("lookup:basic", "$lookup simple equi-join",
  customers,
  [{ $lookup: { from: orders, localField: "id", foreignField: "customerId", as: "orders" } }],
  [
    { id: 10, name: "Alice", orders: [{ orderId: 1, customerId: 10, total: 100 }, { orderId: 3, customerId: 10, total: 50 }] },
    { id: 20, name: "Bob", orders: [{ orderId: 2, customerId: 20, total: 200 }] },
  ]
);

testAggregate("lookup:field-ref", "$lookup from field reference",
  [{ name: "Alice", related: [{ v: 1 }, { v: 2 }] }],
  [{ $lookup: { from: "$related", localField: "v", foreignField: "v", as: "matches" } }],
  [{ name: "Alice", related: [{ v: 1 }, { v: 2 }], matches: [] }]
);

testAggregate("lookup:pipeline", "$lookup with pipeline and _$ var",
  customers,
  [{
    $lookup: {
      from: orders,
      let: { custId: "$id" },
      pipeline: [
        { $match: { $gt: ["$customerId", "_$custId"] } }
      ],
      as: "higherOrders"
    }
  }],
  [
    { id: 10, name: "Alice", higherOrders: [{ orderId: 2, customerId: 20, total: 200 }] },
    { id: 20, name: "Bob", higherOrders: [] },
  ]
);

testAggregate("lookup:combined", "$lookup then $set to compute total",
  customers,
  [
    { $lookup: { from: orders, localField: "id", foreignField: "customerId", as: "orders" } },
    { $set: { total: { $sum: { $map: { input: "$orders", as: "o", in: "$o.total" } } } } },
  ],
  [
    { id: 10, name: "Alice", orders: [{ orderId: 1, customerId: 10, total: 100 }, { orderId: 3, customerId: 10, total: 50 }], total: 150 },
    { id: 20, name: "Bob", orders: [{ orderId: 2, customerId: 20, total: 200 }], total: 200 },
  ]
);

// ─── Set operators ────────────────────────────────────────────────────────────

testAggregate("setUnion(1)", "$setUnion merges two arrays deduplicating",
  [{ a: [1, 2, 3], b: [2, 3, 4] }],
  [{ $set: { r: { $setUnion: ["$a", "$b"] } } }],
  [{ a: [1, 2, 3], b: [2, 3, 4], r: [1, 2, 3, 4] }]
);

testAggregate("setIntersection(1)", "$setIntersection returns common elements",
  [{ a: [1, 2, 3], b: [2, 3, 4] }],
  [{ $set: { r: { $setIntersection: ["$a", "$b"] } } }],
  [{ a: [1, 2, 3], b: [2, 3, 4], r: [2, 3] }]
);

testAggregate("setDifference(1)", "$setDifference returns elements in a not in b",
  [{ a: [1, 2, 3], b: [2, 3, 4] }],
  [{ $set: { r: { $setDifference: ["$a", "$b"] } } }],
  [{ a: [1, 2, 3], b: [2, 3, 4], r: [1] }]
);

testAggregate("setEquals(1)", "$setEquals returns true for identical sets",
  [{ a: [1, 2, 3], b: [3, 1, 2] }],
  [{ $set: { r: { $setEquals: ["$a", "$b"] } } }],
  [{ a: [1, 2, 3], b: [3, 1, 2], r: true }]
);

testAggregate("setEquals(2)", "$setEquals returns false for different sets",
  [{ a: [1, 2], b: [1, 2, 3] }],
  [{ $set: { r: { $setEquals: ["$a", "$b"] } } }],
  [{ a: [1, 2], b: [1, 2, 3], r: false }]
);

testAggregate("setIsSubset(1)", "$setIsSubset returns true when a ⊆ b",
  [{ a: [2, 3], b: [1, 2, 3, 4] }],
  [{ $set: { r: { $setIsSubset: ["$a", "$b"] } } }],
  [{ a: [2, 3], b: [1, 2, 3, 4], r: true }]
);

testAggregate("setIsSubset(2)", "$setIsSubset returns false when a ⊄ b",
  [{ a: [2, 5], b: [1, 2, 3, 4] }],
  [{ $set: { r: { $setIsSubset: ["$a", "$b"] } } }],
  [{ a: [2, 5], b: [1, 2, 3, 4], r: false }]
);

testAggregate("allElementsTrue(1)", "$allElementsTrue returns true when all truthy",
  [{ flags: [true, 1, "yes"] }],
  [{ $set: { r: { $allElementsTrue: "$flags" } } }],
  [{ flags: [true, 1, "yes"], r: true }]
);

testAggregate("allElementsTrue(2)", "$allElementsTrue returns false when any falsy",
  [{ flags: [true, 0, "yes"] }],
  [{ $set: { r: { $allElementsTrue: "$flags" } } }],
  [{ flags: [true, 0, "yes"], r: false }]
);

testAggregate("anyElementTrue(1)", "$anyElementTrue returns true when any truthy",
  [{ flags: [false, 0, 1] }],
  [{ $set: { r: { $anyElementTrue: "$flags" } } }],
  [{ flags: [false, 0, 1], r: true }]
);

testAggregate("anyElementTrue(2)", "$anyElementTrue returns false when all falsy",
  [{ flags: [false, 0, null] }],
  [{ $set: { r: { $anyElementTrue: "$flags" } } }],
  [{ flags: [false, 0, null], r: false }]
);

testAggregate("set-ops:combined", "set pipeline: union → filter matches → intersect result",
  [{ a: [1, 2, 3, 3], b: [3, 4, 5], c: [3, 5, 6] }],
  [
    { $set: { u: { $setUnion: ["$a", "$b"] } } },
    { $set: { r: { $setIntersection: ["$u", "$c"] } } },
    { $set: { isSubset: { $setIsSubset: ["$r", "$c"] } } },
  ],
  [{ a: [1, 2, 3, 3], b: [3, 4, 5], c: [3, 5, 6], u: [1, 2, 3, 4, 5], r: [3, 5], isSubset: true }]
);

// ── Trig & angle conversion ────────────────────────────────────────────────────

testAggregate("trig:sin", "sin of 0 radians is 0",
  [{ a: 0 }],
  [{ $set: { r: { $sin: "$a" } } }],
  [{ a: 0, r: 0 }]
);

testAggregate("trig:cos", "cos of 0 radians is 1",
  [{ a: 0 }],
  [{ $set: { r: { $cos: "$a" } } }],
  [{ a: 0, r: 1 }]
);

testAggregate("trig:degreesToRadians", "90 degrees = PI/2",
  [{ a: 90 }],
  [{ $set: { r: { $degreesToRadians: "$a" } } }],
  [{ a: 90, r: Math.PI / 2 }]
);

testAggregate("trig:radiansToDegrees", "PI radians = 180 degrees",
  [{ a: Math.PI }],
  [{ $set: { r: { $radiansToDegrees: "$a" } } }],
  [{ a: Math.PI, r: 180 }]
);

testAggregate("trig:atan2", "atan2(1,1) = PI/4",
  [{ y: 1, x: 1 }],
  [{ $set: { r: { $atan2: ["$y", "$x"] } } }],
  [{ y: 1, x: 1, r: Math.PI / 4 }]
);

testAggregate("trig:combined", "sin(degreesToRadians(90)) = 1",
  [{ deg: 90 }],
  [{ $set: { r: { $sin: { $degreesToRadians: "$deg" } } } }],
  [{ deg: 90, r: 1 }]
);

// ── $cmp ──────────────────────────────────────────────────────────────────────

testAggregate("cmp(1)", "$cmp returns -1 when a < b",
  [{ a: 1, b: 2 }],
  [{ $set: { r: { $cmp: ["$a", "$b"] } } }],
  [{ a: 1, b: 2, r: -1 }]
);

testAggregate("cmp(2)", "$cmp returns 0 when a === b",
  [{ a: 2, b: 2 }],
  [{ $set: { r: { $cmp: ["$a", "$b"] } } }],
  [{ a: 2, b: 2, r: 0 }]
);

testAggregate("cmp(3)", "$cmp returns 1 when a > b",
  [{ a: 3, b: 2 }],
  [{ $set: { r: { $cmp: ["$a", "$b"] } } }],
  [{ a: 3, b: 2, r: 1 }]
);

// ── Bitwise ───────────────────────────────────────────────────────────────────

testAggregate("bitwise:and", "$bitAnd",
  [{ a: 6, b: 3 }],
  [{ $set: { r: { $bitAnd: ["$a", "$b"] } } }],
  [{ a: 6, b: 3, r: 6 & 3 }]
);

testAggregate("bitwise:or", "$bitOr",
  [{ a: 6, b: 3 }],
  [{ $set: { r: { $bitOr: ["$a", "$b"] } } }],
  [{ a: 6, b: 3, r: 6 | 3 }]
);

testAggregate("bitwise:xor", "$bitXor",
  [{ a: 6, b: 3 }],
  [{ $set: { r: { $bitXor: ["$a", "$b"] } } }],
  [{ a: 6, b: 3, r: 6 ^ 3 }]
);

testAggregate("bitwise:not", "$bitNot",
  [{ a: 6 }],
  [{ $set: { r: { $bitNot: "$a" } } }],
  [{ a: 6, r: ~6 }]
);

// ── $rand ─────────────────────────────────────────────────────────────────────

{
  const r = Aggregate([{ $set: { r: { $rand: [] } } }], [{}]).value[0].r;
  const pass = typeof r === "number" && r >= 0 && r < 1;
  testResults.pass += pass ? 1 : 0;
  if (!pass) testResults.fail.push("rand(1)");
}

// ── $regexMatch ───────────────────────────────────────────────────────────────

testAggregate("regexMatch(1)", "$regexMatch returns true on match",
  [{ name: "Alice" }],
  [{ $set: { m: { $regexMatch: ["$name", "^Al"] } } }],
  [{ name: "Alice", m: true }]
);

testAggregate("regexMatch(2)", "$regexMatch returns false on no match",
  [{ name: "Bob" }],
  [{ $set: { m: { $regexMatch: ["$name", "^Al"] } } }],
  [{ name: "Bob", m: false }]
);

testQuery("regexMatch(3)", "$regexMatch in query predicate",
  [{ name: "Alice" }, { name: "Bob" }],
  { $eq: [{ $regexMatch: ["$name", "^Al"] }, true] },
  [{ name: "Alice" }]
);

// ── $sortByCount ──────────────────────────────────────────────────────────────

testAggregate("sortByCount(1)", "$sortByCount groups and sorts by count descending",
  [{ s: "a" }, { s: "b" }, { s: "a" }, { s: "c" }],
  [{ $sortByCount: "$s" }],
  [{ _id: "a", count: 2 }, { _id: "b", count: 1 }, { _id: "c", count: 1 }]
);

// ── $sample ───────────────────────────────────────────────────────────────────

{
  const rows = [{ x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }, { x: 5 }];
  const result = Aggregate([{ $sample: { size: 3 } }], rows).value;
  const pass = result.length === 3 && result.every(r => rows.some(orig => orig.x === r.x));
  testResults.pass += pass ? 1 : 0;
  if (!pass) testResults.fail.push("sample(1)");
}

// ── Group accumulators: $stdDevPop, $stdDevSamp, $addToSet, $count ─────────────

testAggregate("group:stdDevPop", "$stdDevPop accumulator",
  [{ g: "a", v: 2 }, { g: "a", v: 4 }, { g: "a", v: 4 }, { g: "a", v: 4 }, { g: "a", v: 5 }, { g: "a", v: 5 }, { g: "a", v: 7 }, { g: "a", v: 9 }],
  [{ $group: { _id: "$g", sd: { $stdDevPop: "$v" } } }],
  [{ _id: "a", sd: 2 }]
);

testAggregate("group:stdDevSamp", "$stdDevSamp accumulator",
  [{ g: "a", v: 2 }, { g: "a", v: 4 }, { g: "a", v: 4 }],
  [{ $group: { _id: "$g", sd: { $stdDevSamp: "$v" } } }],
  [{ _id: "a", sd: Math.sqrt(((2-10/3)**2 + (4-10/3)**2 + (4-10/3)**2) / 2) }]
);

testAggregate("group:addToSet", "$addToSet accumulator deduplicates",
  [{ g: "a", v: 1 }, { g: "a", v: 2 }, { g: "a", v: 1 }],
  [{ $group: { _id: "$g", vals: { $addToSet: "$v" } } }],
  [{ _id: "a", vals: [1, 2] }]
);

testAggregate("group:count", "$count accumulator",
  [{ g: "a" }, { g: "a" }, { g: "b" }],
  [{ $group: { _id: "$g", n: { $count: {} } } }, { $sort: { _id: 1 } }],
  [{ _id: "a", n: 2 }, { _id: "b", n: 1 }]
);

// ── $literal ──────────────────────────────────────────────────────────────────

testAggregate("literal(1)", "$literal preserves $-prefixed string",
  [{ price: 10 }],
  [{ $set: { v: { $literal: "$price" } } }],
  [{ price: 10, v: "$price" }]
);

testAggregate("literal(2)", "$literal preserves dot-path string",
  [{ a: { b: 1 } }],
  [{ $set: { v: { $literal: "a.b" } } }],
  [{ a: { b: 1 }, v: "a.b" }]
);

testAggregate("literal(3)", "$literal preserves object as-is",
  [{}],
  [{ $set: { v: { $literal: { x: 1 } } } }],
  [{ v: { x: 1 } }]
);

testQuery("literal(4)", "$literal in query — compare literal string to field value",
  [{ status: "$active" }, { status: "active" }],
  { $eq: ["$status", { $literal: "$active" }] },
  [{ status: "$active" }]
);

// ── $$CURRENT ─────────────────────────────────────────────────────────────────

// $$CURRENT returns the live row — use it in $replaceWith to keep only selected fields
testAggregate("current(1)", "$$CURRENT usable in $replaceWith via mergeObjects",
  [{ a: 1, b: 2, c: 3 }],
  [{ $replaceWith: { $mergeObjects: ["$$CURRENT", { extra: true }] } }],
  [{ a: 1, b: 2, c: 3, extra: true }]
);

// $$CURRENT — field count via $objectToArray
testAggregate("current(2)", "$$CURRENT — field count via $objectToArray",
  [{ a: 1, b: 2 }],
  [{ $set: { n: { $size: { $objectToArray: "$$CURRENT" } } } }],
  [{ a: 1, b: 2, n: 2 }]
);

logger.log(`summary:total`, `Tests executed: ${testResults.pass + testResults.fail.length}`);
logger.log(`summary:pass`, `Tests passed: ${testResults.pass}`, LogColor.GREEN);
logger.log(`summary:fail`, `Tests failed: ${testResults.fail.length} ${testResults.fail.length ? `[${testResults.fail.join(",")}]` : ""}`, testResults.fail.length === 0 ? LogColor.GREEN : LogColor.RED);

process.exit(~~(testResults.fail.length > 0))
