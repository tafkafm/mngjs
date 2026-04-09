// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

// mngjs — MongoDB-style queries and aggregation for in-memory JavaScript arrays

// ---------------------------------------------------------------------------
// Core value types
// ---------------------------------------------------------------------------

/** Any plain document / row. */
export type Row = Record<string, unknown>;

/** A scalar value. */
export type Primitive = string | number | boolean | null | Date;

/** A field reference, e.g. "$fieldName". Resolved against the current row. */
export type FieldRef = `$${string}`;

/**
 * Double-deref, e.g. "$$pointer". Reads the value of the named field, then
 * uses that value as a second field name to look up.
 */
export type DoubleDeref = `$$${string}`;

/**
 * A $let-scoped variable, e.g. "_$varName". Equivalent to MongoDB's "$$varName"
 * inside a $let expression ($$  is used for double-deref in this engine).
 */
export type LocalVar = `_$${string}`;

// ---------------------------------------------------------------------------
// Expression language
// ---------------------------------------------------------------------------

/**
 * Any value usable as an expression: a field reference, a literal, or an
 * operator object. `unknown` is intentional — expressions are evaluated
 * dynamically and can produce any type.
 */
export type Expr =
  | FieldRef
  | DoubleDeref
  | LocalVar
  | Primitive
  | Expr[]
  | ExprOperator;

/** An object whose single key is a $-prefixed operator. */
export type ExprOperator = {
  // Arithmetic
  $add?:      Expr[];
  $subtract?: Expr[];
  $multiply?: Expr[];
  $mul?:      Expr[];
  $divide?:   Expr[];
  $mod?:      Expr[];
  $pow?:      Expr[];
  $abs?:      Expr;
  $ceil?:     Expr;
  $floor?:    Expr;
  $round?:    Expr | [Expr, Expr?];
  $sqrt?:     Expr;
  $trunc?:    Expr;
  $exp?:      Expr;
  $ln?:       Expr;
  $log?:      [Expr, Expr];
  $log10?:    Expr;
  $sum?:      Expr | Expr[];
  $avg?:      Expr | Expr[];
  $min?:      Expr | Expr[];
  $max?:      Expr | Expr[];

  // String
  $concat?:       Expr[];
  $strConcat?:    Expr[];
  $toLower?:      Expr;
  $toUpper?:      Expr;
  $toString?:     Expr;
  $strLenCP?:     Expr;
  $substr?:       [Expr, Expr, Expr?];
  $split?:        [Expr, Expr];
  $trim?:         Expr | { input: Expr; chars?: string };
  $ltrim?:        Expr | { input: Expr; chars?: string };
  $rtrim?:        Expr | { input: Expr; chars?: string };
  $indexOfCP?:    [Expr, Expr, Expr?, Expr?];
  $regexFind?:    { input: Expr; regex: Expr; options?: string };
  $regexFindAll?: { input: Expr; regex: Expr; options?: string };
  $replaceOne?:   { input: Expr; find: Expr; replacement: Expr };
  $replaceAll?:   { input: Expr; find: Expr; replacement: Expr };

  // Array
  $size?:         Expr;
  $push?:         [Expr, Expr];
  $pop?:          [Expr, Expr?];
  $concatArrays?: Expr[];
  $elemAt?:       [Expr, Expr];
  $slice?:        [Expr, Expr, Expr?];
  $first?:        [Expr, Expr];
  $reverseArray?: Expr;
  $range?:        [Expr, Expr, Expr?];
  $indexOfArray?: [Expr, Expr];
  $sortArray?:    { input: Expr; sortBy: 1 | -1 | Record<string, 1 | -1> };
  $zip?:          { inputs: Expr[]; useLongestLength?: boolean; defaults?: Expr[] };
  $flatten?:      [Expr, Expr?];
  $arrayToObject?: Expr;
  $objectToArray?: Expr;
  $filter?: {
    input: Expr;
    as: string;
    cond: Expr;
  };
  $map?: {
    input: Expr;
    as: string;
    in: Expr;
  };
  $reduce?: {
    input: Expr;
    initialValue: Expr;
    in: Expr;
  };

  // Set
  $setUnion?:        Expr[];
  $setIntersection?: Expr[];
  $setDifference?:   [Expr, Expr];
  $setEquals?:       Expr[];
  $setIsSubset?:     [Expr, Expr];
  $allElementsTrue?: Expr;
  $anyElementTrue?:  Expr;

  // Conditional
  $cond?:   [Expr, Expr, Expr];
  $switch?: {
    branches: Array<{ case: Expr; then: Expr }>;
    default?: Expr;
  };
  $ifNull?: Expr[];

  // Type / conversion
  $type?:     Expr;
  $isArray?:  Expr;
  $isNumber?: Expr;
  $isString?: Expr;
  $isObject?: Expr;
  $isDate?:   Expr;
  $toInt?:    Expr;
  $toDouble?: Expr;
  $toBool?:   Expr;
  $toDate?:   Expr;

  // Date extraction
  $date?:        Expr | [Expr, Expr?, Expr?];
  $dateToString?:  { date: Expr; format?: string; timezone?: Expr };
  $dateFromString?:{ dateString: Expr; format?: string; timezone?: Expr };
  $dateAdd?:     { startDate: Expr; unit: string; amount: Expr; timezone?: Expr };
  $dateSubtract?:{ startDate: Expr; unit: string; amount: Expr; timezone?: Expr };
  $dateDiff?:    { startDate: Expr; endDate: Expr; unit: string };
  $year?:        Expr | [Expr, Expr?];
  $month?:       Expr | [Expr, Expr?];
  $dayOfMonth?:  Expr | [Expr, Expr?];
  $dayOfWeek?:   Expr | [Expr, Expr?];
  $dayOfYear?:   Expr | [Expr, Expr?];
  $hour?:        Expr | [Expr, Expr?];
  $minute?:      Expr | [Expr, Expr?];
  $second?:      Expr | [Expr, Expr?];
  $millisecond?: Expr | [Expr, Expr?];
  $isoDayOfWeek?: Expr;
  $isoWeek?:     Expr;
  $isoWeekYear?: Expr;
  $week?:        Expr;

  // Misc
  $mergeObjects?: Expr[];
  $let?: {
    vars: Record<string, Expr>;
    in: Expr;
  };

  // Escape hatch — custom function (see $func)
  $func?: FuncOperator;

  // Allow any other operator key
  [key: `$${string}`]: unknown;
};

// ---------------------------------------------------------------------------
// $func — custom operator
// ---------------------------------------------------------------------------

/** Context passed to a $func custom operator function. */
export interface FuncContext {
  evaluate: (expr: unknown, row: Row, context?: unknown) => EvalResult;
  getField:  (context: unknown, key: string, query: unknown, row: Row) => EvalResult | undefined;
  getValue:  (context: unknown, key: string, query: unknown, row: Row, expand?: boolean) => EvalResult;
  getArgs:   (op: unknown, args: unknown[], row: Row, context?: unknown) => EvalResult[];
  trace:     (context: unknown, existing: string[] | undefined, ...messages: unknown[]) => string[];
  log:       (...args: unknown[]) => void;
  [key: string]: unknown;
}

/** The function signature accepted by $func. Must return an EvalResult. */
export type FuncOperator = (context: FuncContext, row: Row, ...args: unknown[]) => EvalResult;

/** The internal result type returned by evaluate() and all operator funcs. */
export interface EvalResult {
  value: unknown;
  trace: string[];
}

// ---------------------------------------------------------------------------
// Query layer
// ---------------------------------------------------------------------------

/**
 * A query expression. Can be:
 * - A plain field-equality map: `{ field: value }`
 * - A comparison on the row itself: `{ $eq: 5 }`
 * - Any combination of field conditions and logical operators
 */
export type QueryExpr =
  | { [field: string]: unknown }
  | LogicalQueryExpr
  | ComparisonQueryExpr;

export interface LogicalQueryExpr {
  $and?: QueryExpr[];
  $or?:  QueryExpr[];
  $nor?: QueryExpr[];
  $not?: QueryExpr;
}

export interface ComparisonQueryExpr {
  $eq?:       unknown;
  $ne?:       unknown;
  $gt?:       unknown;
  $gte?:      unknown;
  $lt?:       unknown;
  $lte?:      unknown;
  $in?:       unknown[] | FieldRef;
  $nin?:      unknown[] | FieldRef;
  $regex?:    string | RegExp;
  $exists?:   boolean;
  $nonnull?:  [unknown, boolean?];
  $deq?:      [Expr, Expr];
  $all?:      unknown[];
  $elemMatch?: unknown;
  $size?:     number;
  $bitsAllSet?:   number;
  $bitsAllClear?: number;
  $bitsAnySet?:   number;
  $bitsAnyClear?: number;
}

// ---------------------------------------------------------------------------
// Aggregation pipeline stages
// ---------------------------------------------------------------------------

export type Stage =
  | { $match:       QueryExpr | ComparisonQueryExpr }
  | { $set:         Record<string, Expr> }
  | { $addFields:   Record<string, Expr> }
  | { $unset:       string | string[] }
  | { $project:     Record<string, 0 | 1 | false | true | Expr> }
  | { $replaceRoot: { newRoot: Expr } }
  | { $replaceWith: Expr }
  | { $group:       GroupSpec }
  | { $sort:        Record<string, 1 | -1> }
  | { $skip:        number }
  | { $limit:       number }
  | { $count:       string }
  | { $unwind:      string | UnwindSpec }
  | { $lookup:      LookupSpec }
  | { $func:        FuncOperator };

export interface GroupSpec {
  _id: Expr | Record<string, Expr> | null;
  [accumulator: string]: GroupAccumulator | Expr | null;
}

export type GroupAccumulator =
  | { $sum:   Expr }
  | { $avg:   Expr }
  | { $min:   Expr }
  | { $max:   Expr }
  | { $push:  Expr }
  | { $first: Expr }
  | { $last:  Expr }
  | { $count: Record<string, never> }
  | { $func:  (context: unknown, groupRows: Row[]) => EvalResult };

export interface UnwindSpec {
  path: string;
  includeArrayIndex?: string;
  preserveNullAndEmptyArrays?: boolean;
}

export type LookupSpec =
  | {
      from:         Row[] | FieldRef;
      localField:   string;
      foreignField: string;
      as:           string;
    }
  | {
      from:     Row[] | FieldRef;
      let?:     Record<string, Expr>;
      pipeline: Stage[];
      as:       string;
    };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface QueryOptions {
  /** Override trace collection for this predicate. Defaults to global `traceEnabled`. */
  trace?: boolean;
  /** Force verbose logging for this query. */
  forceLog?: boolean;
  /**
   * Clone each row before evaluating. Defaults to `false`.
   * Set to `true` when the query uses mutation operators (`$set`, `$push`, etc.)
   * and you want to protect the source rows.
   */
  clone?: boolean;
}

export interface AggregateOptions {
  /** Override trace collection for this pipeline. Defaults to global `traceEnabled`. */
  trace?: boolean;
  /** Force verbose logging for this pipeline. */
  forceLog?: boolean;
  /**
   * Clone the input rows before processing. Defaults to `true`.
   * Set to `false` to skip cloning for a performance gain when mutation of
   * source rows is acceptable.
   */
  clone?: boolean;
  /**
   * Emit trace messages for both passing and failing conditions.
   * Implies `trace: true`. Use `Explain` as a convenience wrapper.
   */
  forceTrace?: boolean;
}

export interface AggregateResult<T extends Row = Row> {
  /** Rows that passed all pipeline stages. */
  value: T[];
  /**
   * Nested failure trace. Each outer entry corresponds to a pipeline stage;
   * inner strings are human-readable explanations of why individual rows were excluded.
   */
  trace: string[][];
}

/**
 * Returns a predicate function for use with `Array.filter` or any single-row evaluation.
 *
 * @example
 * const active = data.filter(Query({ status: "active", score: { $gt: 50 } }));
 */
export declare function Query(
  query: QueryExpr,
  options?: QueryOptions
): (row: unknown) => boolean;

/**
 * Pre-compiles a query into a fast predicate `(row) => boolean`.
 *
 * The query tree is walked once at call time; the returned function performs no
 * operator dispatch on each invocation, making it faster than `Query` for
 * repeated use on large datasets.
 *
 * The existing `Query`, `Aggregate`, and `Explain` paths are completely untouched.
 *
 * @example
 * const isActive = CompileQuery({ status: "active", score: { $gt: 50 } });
 * const results  = data.filter(isActive);
 */
export declare function CompileQuery(
  query: QueryExpr,
  options?: QueryOptions
): (row: unknown) => boolean;

/**
 * Tests a single row against a query. Convenience wrapper around `Query` that
 * returns a plain boolean instead of a predicate function.
 *
 * @example
 * if (Test({ status: "active", score: { $gt: 50 } }, row)) { ... }
 */
export declare function Test(
  query: QueryExpr,
  row: unknown,
  options?: QueryOptions
): boolean;

/**
 * Runs a pipeline of stages over an array of rows.
 *
 * @example
 * const { value, trace } = Aggregate([
 *   { $match: { active: true } },
 *   { $group: { _id: "$department", total: { $sum: "$salary" } } },
 *   { $sort: { total: -1 } },
 * ], employees);
 */
export declare function Aggregate<T extends Row = Row>(
  pipeline: Stage[],
  rows: Row[],
  options?: AggregateOptions
): AggregateResult<T>;

/**
 * Global trace flag. Controls whether trace accumulation is active by default.
 * Prefer overriding per-call via `options.trace` rather than mutating this
 * global directly — per-call override is safe for concurrent usage and does
 * not require cleanup.
 *
 * @example
 * import { traceEnabled } from "mngjs";
 * traceEnabled = false; // disable globally in production
 *
 * // preferred: per-call override
 * Query({ status: "active" }, { trace: false })(row);
 */
/**
 * Runs a pipeline with `forceTrace: true`, collecting trace messages for both
 * passing and failing conditions on every row. Equivalent to MongoDB's `explain`.
 *
 * @example
 * const { value, trace } = Explain([
 *   { $match: { status: "active", score: { $gt: 50 } } }
 * ], data);
 * // trace includes why each row passed or failed every condition
 */
export declare function Explain<T extends Row = Row>(
  pipeline: Stage[],
  rows: Row[],
  options?: Omit<AggregateOptions, "forceTrace">
): AggregateResult<T>;

export declare let traceEnabled: boolean;
