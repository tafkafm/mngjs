// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "./lib/utils.js";
import { raise } from "./lib/utils.js";
import * as ext from "./lib/extensions.js";
import { LogLevel } from "./lib/logger.js";
import "./lib/operators/index.js";
import "./lib/operators/compile.js";
import { evaluate, logger, GLOBAL } from "./lib/engine.js";
import { compileExpr } from "./lib/compiler.js";

export { traceEnabled } from "./lib/engine.js";

/**
 * Returns a predicate `(row) => boolean` for use with `Array.filter` or any
 * single-row evaluation. The query tree is re-walked on every call; use
 * `CompileQuery` when filtering large datasets repeatedly.
 * @param {import("./index.d.ts").QueryExpr} query
 * @param {import("./index.d.ts").QueryOptions} [options]
 * @returns {(row: unknown) => boolean}
 */
export const Query = (query, options = {}) => {
  return (row) => {
    const ctx = { forceLog: options.forceLog };
    if (options.trace !== undefined) {
      ctx.trace = !!options.trace;
    }
    return evaluate(query, options.clone ? ext.klone(row) : row, ctx)?.value;
  };
};

/**
 * Tests a single `row` against `query`. Convenience wrapper around `Query`
 * that returns a plain `boolean` instead of a predicate function.
 * @param {import("./index.d.ts").QueryExpr} query
 * @param {unknown} row
 * @param {import("./index.d.ts").QueryOptions} [options]
 * @returns {boolean}
 */
export const Test = (query, row, options = {}) => {
  return !!Query(query, options)(row);
};

/**
 * Runs a pipeline of stages over an array of rows. Returns `{ value, trace }`.
 * Input rows are deep-cloned by default (`clone: true`); pass `clone: false`
 * to skip cloning for a performance gain when mutation of source rows is acceptable.
 * @param {import("./index.d.ts").Stage[]} query
 * @param {object[]} rows
 * @param {import("./index.d.ts").AggregateOptions} [options]
 * @returns {import("./index.d.ts").AggregateResult}
 */
export const Aggregate = (query, rows, options = {}) => {
  if (!Array.isArray(query)) {
    logger.log("Aggregate", `Query argument needs to be an array. Got '${util.typeOf(query)}'. Implicitly converting to array.`, LogLevel.WARN);
    query = [query];
  }

  if (!Array.isArray(rows)) {
    raise(`Rows argument needs to be an array. Got '${util.typeOf(rows)}'`);
  }

  const ctx = { forceLog: options.forceLog };
  if (options.trace !== undefined) {
    ctx.trace = !!options.trace;
  }
  if (options.forceTrace) {
    ctx.forceTrace = true;
    ctx.trace = true;
  }

  let result = { value: options.clone !== false ? ext.klone(rows) : rows, trace: [] };

  for (const line of query) {
    const temp = [];
    let stageTrace = [];

    for (const row of result.value) {
      const res = evaluate(line, row, { ...ctx, rows: result.value });

      if (res?.value === false) {
        stageTrace = stageTrace.concat(res?.trace ?? []);
      } else {
        if (ctx.forceTrace && res?.trace?.length) {
          stageTrace = stageTrace.concat(res.trace);
        }
        if (res?.value != null) {
          if (res?.value === true) {
            temp.push(row);
          } else if (Array.isArray(res?.value)) {
            temp.push(...(res?.value ?? []));
          } else {
            temp.push(res?.value);
          }
        }
      }

      if (res?.[GLOBAL]) {
        break;
      }
    }

    if (stageTrace.length) {
      result.trace = stageTrace.concat(result.trace);
    }

    result.value = temp;
  }

  return result;
}

/**
 * Drop-in replacement for `Aggregate` that sets `forceTrace: true`, emitting
 * trace messages for both passing and failing conditions on every row.
 * @param {import("./index.d.ts").Stage[]} query
 * @param {object[]} rows
 * @param {Omit<import("./index.d.ts").AggregateOptions, "forceTrace">} [options]
 * @returns {import("./index.d.ts").AggregateResult}
 */
export const Explain = (query, rows, options = {}) => {
  return Aggregate(query, rows, { ...options, forceTrace: true });
}

/**
 * Pre-compiles a query into a fast predicate `(row) => boolean`.
 * The query tree is walked once at call time; the returned function
 * does no operator dispatch on each invocation.
 *
 * Drop-in replacement for `Query` when you need maximum filter throughput.
 * The existing `Query`, `Aggregate`, and `Explain` paths are untouched.
 *
 * @param {object} query   - A mngjs query expression (same shape as `Query`).
 * @param {object} options - Reserved for future use.
 * @returns {(row: unknown) => boolean}
 */
export const CompileQuery = (query, _options = {}) => {
  const fn = compileExpr(query);
  return (row) => !!fn(row);
};
