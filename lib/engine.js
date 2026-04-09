// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "./utils.js";
import { raise, normalizeDateString } from "./utils.js";
import * as ext from "./extensions.js";
import { Logger, LogLevel, LogLevels, ForceLog } from "./logger.js";
import { Operators, GLOBAL, Args } from "./operators/registry.js";

const logger = new Logger({
  logLevel: LogLevels.INFO,
  defaultLevel: LogLevels.DEBUG
});

/**
 * Returns the number of leading `$` characters in a string (1 for `$field`,
 * 2 for `$$field`, etc.), or `undefined` if the value is not a `$`-prefixed string.
 * Used to distinguish field references from literals and operator keys.
 * @param {unknown} value
 * @returns {number|undefined}
 */
export const isVar = (value) => value?.match?.(/^(\$+)/)?.[1]?.length;

/**
 * Coerces `value` to a `Date`. Accepts `Date` instances, ISO strings, and
 * numeric timestamps. Throws if the value cannot be parsed as a valid date.
 * @param {unknown} value
 * @param {string} opName - Operator name used in the error message.
 * @returns {Date}
 */
export const coerceDate = (value, opName) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(normalizeDateString(value));
    isNaN(d.getTime()) && raise(`${opName}: invalid date: ${util.toString(value)}`);
    return d;
  }

  raise(`${opName}: expected a Date, string, or number, got: ${util.toString(value)}`);
};

/**
 * Returns a new array with duplicate values removed, using deep equality
 * (`isEqualValue`) for comparison. Preserves first occurrence of each value.
 * @param {unknown[]} arr
 * @returns {unknown[]}
 */
export const setDedupe = (arr) => arr.filter((item, i) => arr.findIndex(x => util.isEqualValue(x, item)) === i);

export let traceEnabled = true;

/**
 * Prepends `messages` to the `existing` trace array when tracing is enabled.
 * Tracing is enabled when `context.trace` is explicitly `true`, or when the
 * global `traceEnabled` flag is set and `context.trace` is `undefined`.
 * Returns the (possibly mutated) `existing` array.
 * @param {object|undefined} context
 * @param {string[]|undefined} existing
 * @param {...(string|string[]|null|undefined)} messages
 * @returns {string[]}
 */
const trace = (context, existing, ...messages) => {
  existing ??= [];

  const enabled = context?.trace !== undefined ? context.trace !== false : traceEnabled;
  if (!enabled) {
    return existing;
  }

  existing.unshift(...messages.flat().filter(m => m != null));
  return existing;
};

export { trace };

/**
 * Resolves and evaluates the argument list for an operator call.
 * Accepts either a single array argument (MongoDB-style `[$a, $b]`) or
 * individual positional arguments. Throws if fewer than `minCount` args are
 * provided.
 * @param {object} op - Operator descriptor (must have `.name` and optionally `.minArgCount`).
 * @param {unknown[]} args - Raw argument list from the query.
 * @param {object} row - Current document being evaluated.
 * @param {object} [context={}]
 * @param {number} [minCount]
 * @returns {Array<{value: unknown, trace: string[]}>}
 */
const getArgs = (op, args, row, context = {}, minCount = op.minArgCount ?? 2) => {
  !Array.isArray(args) && raise(`getArgs: bad arguments given for $${op.name}: ${util.toString(args)}`);

  if (args.length === 1 && Array.isArray(args[0]) && args[0].length >= minCount) {
    return args[0].map(arg => evaluate(arg, row, context));
  }

  if (args.length >= minCount) {
    return args.map(arg => evaluate(arg, row, context));
  }

  raise(`getArgs: $${op.name} requires at least ${minCount} arguments. got ${args.length} (${util.toString(args)})`);
}

export { getArgs };

/**
 * Looks up an operator by its short name (without leading `$`), following
 * alias chains. Returns `undefined` if no operator is registered for `key`.
 * @param {string} key
 * @returns {object|undefined}
 */
export const getOperator = (key) => {
  return Operators[Operators[key]?.alias] ?? Operators[key];
}

/**
 * Resolves the LHS key of a query pair against the current row and context.
 * Handles `_$varName` (let-scope), `$field` (single-deref), `$$field`
 * (double-deref), bare operator keys, and literal strings.
 * Returns `{ value, operator? }`.
 * @param {object} context
 * @param {string} key
 * @param {object} value - The full query object (used for logging only).
 * @param {object} row
 * @param {boolean} [expand=false] - When true, resolve plain strings as field paths.
 * @returns {{ value: unknown, operator?: object }}
 */
const getField = (context, key, value, row, expand = false) => {
  logger.log(`getField:${key}:input`, value, LogLevel.SILLY, ForceLog[!!context?.forceLog]);

  !key && raise("getField: got an empty key");
  typeof key !== "string" && raise(`getField: key must be a string but got '${util.typeOf(key)}'`);

  const result = {};

  if (key.startsWith("_$")) {
    result.value = context?.vars?.[key.substring(2)];
    logger.log(`getField:${key}:result`, result, LogLevel.SILLY);
    return result;
  }

  const varLength = isVar(key) ?? 0;
  if (varLength >= 1 && varLength <= 2) {
    result.operator = getOperator(key.substring(1));
    result.value = result.operator ? key.substring(1) : varLength === 1 ? ext.valueForKeypath(row, key.substring(1)) : ext.valueForKeypath(row, ext.valueForKeypath(row, key.substring(2)));
  } else {
    result.value = expand ? ext.valueForKeypath(row, key) : key;
  }

  logger.log(`getField:${key}:result`, result, LogLevel.SILLY);

  return result;
}

export { getField };

/**
 * Resolves the RHS value of a query pair, detecting whether it is a field
 * reference (`$field`, `$$field`), a nested operator object, or a plain
 * literal. Returns `{ value: unknown[], operator?: object[] }` — value is
 * always an array to support multi-operator dispatch.
 * @param {object} context
 * @param {string} key
 * @param {object} value - The full query object containing `key`.
 * @param {object} row
 * @param {boolean} isArg - Whether the LHS was already identified as an operator.
 * @param {boolean} [expand=true] - When true, expand nested operator objects.
 * @returns {{ value: unknown[], operator?: object[] }}
 */
const getValue = (context, key, value, row, isArg, expand = true) => {
  logger.log(`getValue:${key}:input`, value, LogLevel.SILLY);

  !key && raise("getValue: got an empty key");
  typeof key !== "string" && raise(`getValue: key must be a string but got '${util.typeOf(key)}'`);

  const result = {};

  const varLength = isVar(value[key]) ?? 0;
  if ((typeof value[key] === "string" && varLength >= 1 && varLength <= 2)) {
    const operator = getOperator(key.substring(1));
    result.operator = operator ? [operator] : [];
    result.value = [
      result.operator.length
        ? value[key]
        : varLength === 1
          ? ext.valueForKeypath(row, value[key].substring(1))
          : ext.valueForKeypath(row, ext.valueForKeypath(row, value[key].substring(2)))
    ];
  } else {
    result.value = [value?.[key]];
    const keys = Object.keys(result.value?.[0] ?? {});

    if (expand && keys.length && keys.filter(key => isVar(key) && getOperator(key.substring(1))).length === keys.length) {
      result.operator = keys.map(key => getOperator(key.substring(1)));
      result.value = isArg ? result.value : Object.values(result.value?.[0] ?? {});
    }
  }

  logger.log(`getValue:${key}:result`, result, LogLevel.SILLY, !!ForceLog[context?.forceLog]);

  return result;
}

export { getValue };

/**
 * Core recursive evaluator. Resolves `query` against `row` in `context` and
 * returns `{ value, trace }`. Handles:
 * - `"$$ROOT"` — returns a deep clone of the row
 * - Array queries — maps over items, accumulating traces
 * - Primitive / field-ref scalars — resolves via `getField`
 * - Object queries — iterates keys, dispatches to operators, short-circuits on falsy
 * @param {unknown} query
 * @param {object} row
 * @param {object|undefined} context
 * @returns {{ value: unknown, trace: string[] }}
 */
export const evaluate = (query, row, context) => {
  context ??= {};
  if (context.trace === undefined) {
    context.trace = traceEnabled;
  }
  context.operator ??= Operators.eq;

  logger.log("evaluate", query, row);

  const { operator: operatorContext } = context;

  if (query === "$$ROOT") {
    return { value: ext.klone(row), trace: [] };
  }

  if (query === "$$CURRENT") {
    return { value: row, trace: [] };
  }

  if (Array.isArray(query)) {
    let traces = [];

    const value = query.map(item => {
      const temp = evaluate(item, row, { operator: Operators.set });
      traces = trace(context, traces, temp?.trace);
      return temp?.value;
    });

    return {
      value,
      trace: traces
    };
  }

  if (!util.isObject(query)) {
    return { value: typeof query === "string" && (isVar(query) || query.startsWith("_$")) ? getField(context, query, query, row)?.value : query, trace: [] };
  }

  const keys = Object.keys(query);

  if (keys.length === 0) {
    return true;
  }

  const result = { value: ext.klone(context?.result) ?? {}, trace: [] };

  for (const key of keys) {
    const field = getField(context, key, query, row, operatorContext.expandField !== false);
    const value = getValue(context, key, query, row, !!field.operator, operatorContext.expandValue !== false && field.operator?.expandValue !== false);

    if (!util.isObject(row)) {
      field.value = row;
      value.operator = field.operator;
      field.operator = undefined;
    }

    const operator = [field?.operator, value?.operator].find(op => op?.length ?? op) ?? operatorContext;

    let index = 0;
    let args;

    for (const op of Array.isArray(operator) ? operator : [operator]) {
      if (field.operator) {
        const rawArg = value.value?.[index];
        let argValue;

        if (value.operator?.length === 1 && !op.rawArg) {
          const preEvalArg = evaluate(rawArg, row, context)?.value;
          argValue = Array.isArray(preEvalArg) ? rawArg : preEvalArg;
        } else {
          argValue = rawArg;
        }
        args = Args.from([argValue]);
      } else {
        if (op.rhs === true) {
          args = Args.from([field.value, value.value?.[index]]);
        } else {
          const argValue = value.value?.[index];
          args = Args.from([argValue]);
        }
      }

      const temp = op.func(context ?? {}, row, ...args);
      result.trace = trace(context, result.trace, temp.trace);
      result[GLOBAL] = temp[GLOBAL];

      if (op === Operators.set && temp.value !== undefined) {
        ext.mergeWith(result.value, ext.klone(temp.value) ?? {});
      } else {
        if (operatorContext === Operators.set && !field.operator) {
          ext.mergeWith(result.value, { [key]: temp.value });
        } else {
          result.value = temp.value;

          if (!result.value) {
            break;
          }
        }
      }

      if (result[GLOBAL]) {
        break;
      }

      index++;
    }

    if (!result.value) {
      break;
    }
  }

  logger.log("evaluate:result", result, ForceLog[!!context?.forceLog]);

  return result;
}

export { logger, LogLevel, LogLevels, ForceLog, GLOBAL };
