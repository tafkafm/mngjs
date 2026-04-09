// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "../utils.js";
import * as ext from "../extensions.js";
import { raise } from "../utils.js";
import { getArgs, evaluate, trace, logger, getField, getValue } from "../engine.js";
import { Operators } from "./registry.js";
import deepEqual from "fast-deep-equal";

export const operatorsCore = {

  deq: {
    name: "deq",
    rhs: false,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.deq, args, row, { ...(context ?? {}), operator: Operators.set });

      const arg1 = results[0]?.value?.valueOf();
      const arg2 = results[1]?.value?.valueOf();

      const type1 = util.typeOf(arg1);
      const type2 = util.typeOf(arg2);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: false };

      if (type1 !== type2) {
        result.trace = trace(context, result.trace, `$eq: type of ${util.toString(args[0])} ('${type1}') does not equal type of ${util.toString(arg2)} ('${type2}')`);
      } else {
        if (util.isNonPrimitive(arg1)) {
          result.value = deepEqual(arg1, arg2);
        } else {
          result.value = arg1 === arg2;
        }

        if (!result.value) {
          result.trace = trace(context, result.trace, `$eq: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) does not equal(===) to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
        } else if (context?.forceTrace) {
          result.trace = trace(context, result.trace, `$eq: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) equals ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
        }
      }

      return result;
    }
  },

  eq: {
    name: "eq",
    rhs: true,
    minArgCount: 1,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.eq, args, row, context);

      const value1 = results[0]?.value != null ? results[0]?.value?.valueOf() : results[0]?.value;
      const value2 = results[1]?.value != null ? results[1]?.value?.valueOf() : results[1]?.value

      const result = {
        trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [],
        value: value1 === value2
      };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$eq: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${value1}) does not equal(===) to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${value2})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$eq: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${value1}) equals ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${value2})`);
      }

      return result;
    }
  },

  eq2: {
    name: "eq2",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.eq2, args, row, context);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: results[0]?.value?.valueOf() == results[1]?.value?.valueOf() };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$eq: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) does not equal(==) to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$eq: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) equals(==) ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  ne: {
    name: "ne",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.ne, args, row, context);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: results[0]?.value?.valueOf() !== results[1]?.value?.valueOf() };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$ne: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is equal(===) to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$ne: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not equal to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  ne2: {
    name: "ne2",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.ne2, args, row, context);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: results[0]?.value?.valueOf() != results[1]?.value?.valueOf() };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$ne: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is equal(==) to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$ne: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not equal(==) to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  gt: {
    name: "gt",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.gt, args, row, context);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: results[0]?.value?.valueOf() > results[1]?.value?.valueOf() };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$gt: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not greater than ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$gt: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is greater than ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  gte: {
    name: "gte",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.gte, args, row, context);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: results[0]?.value?.valueOf() >= results[1]?.value?.valueOf() };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$gte: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not greater than or equal to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$gte: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is greater than or equal to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  lt: {
    name: "lt",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.lt, args, row, context);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: results[0]?.value?.valueOf() < results[1]?.value?.valueOf() };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$lt: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not less than ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$lt: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is less than ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  lte: {
    name: "lte",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.lte, args, row, context);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: results[0]?.value?.valueOf() <= results[1]?.value?.valueOf() };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$lte: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not less than or equal to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$lte: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is less than or equal to ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  regex: {
    name: "regex",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.regex, args, row, context);
      const string = results[0]?.value?.valueOf();
      const arg1 = results[1]?.value?.valueOf();
      let regex = (Array.isArray(arg1) ? arg1[0] : arg1).valueOf();
      const options = Array.isArray(arg1) && arg1[1];

      regex = string?.constructor === RegExp ? regex : options ? new RegExp(regex, options) : regex;

      const result = {
        trace: (results?.[0]?.trace ?? []).concat(results?.[1]?.trace ?? []).concat(results?.[2]?.trace ?? []),
        value: string.match(regex)
      };

      if (!result.value) {
        result.trace = trace(context, result.trace, `$regex: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${string}) does not match ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${regex})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$regex: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${string}) matches ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${regex})`);
      }

      return result;
    }
  },

  and: {
    name: "and",
    func: (context, row, ...args) => {
      !Array.isArray(args?.[0]) && raise(`$and failed. not an array: ${util.toString(args?.[0])}`);

      let traces = [];
      const result1 = args?.[0].every(c => {
        const result = evaluate(c, row, context);
        traces = trace(context, traces, result?.trace);

        return result?.value;
      });

      const result = { value: result1, trace: traces };
      if (!result.value) {
        result.trace = trace(context, traces, `$and condition failed: ${util.toString(args?.[0])}`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$and: all conditions passed`);
      }

      return result;
    }
  },

  or: {
    name: "or",
    func: (context, row, ...args) => {
      !Array.isArray(args?.[0]) && raise(`$or failed. not an array: ${util.toString(args?.[0])}`);

      let traces = [];
      const result1 = args?.[0].some(c => {
        const result = evaluate(c, row, context);
        traces = trace(context, traces, result?.trace);

        return result?.value;
      });

      const result = { value: result1, trace: traces };
      if (!result.value) {
        result.trace = trace(context, traces, `$or condition failed: ${util.toString(args?.[0])}`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$or: a condition passed`);
      }

      return result;
    }
  },

  nor: {
    name: "nor",
    func: (context, row, ...args) => {
      !Array.isArray(args?.[0]) && raise(`$nor failed. not an array: ${util.toString(args?.[0])}`);

      let traces = [];
      const result1 = !args?.[0].some(c => {
        const result = evaluate(c, row, context);
        traces = trace(context, traces, result?.trace);
        return result?.value;
      });

      const result = { value: result1, trace: traces };
      if (!result.value) {
        result.trace = trace(context, traces, `$nor condition failed: ${util.toString(args?.[0])}`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$nor: no conditions passed`);
      }

      return result;
    }
  },

  match: {
    name: "match",
    expandValue: false,
    func: (context, row, ...args) => {
      !(Object.keys(args?.[0] ?? {}).length > 0) && raise("$match: no matching criteria given");

      let traces = [];

      const result1 = Object.keys(args[0]).every(p => {
        const result = evaluate({ [p]: args[0][p] }, row, context);
        traces = trace(context, traces, result?.trace);

        return result?.value;
      });

      const result = { value: result1, trace: traces };
      if (!result.value) {
        result.trace = trace(context, traces, `$match failed: ${util.toString(args?.[0])}`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$match: passed`);
      }

      return result;
    }
  },

  exists: {
    name: "exists",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.nonnull, args, row, context);

      const result1 = (results?.[0]?.value === undefined) === !(results?.[1]?.value ?? true);

      const result = {
        trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [],
        value: result1
      }

      if (!result.value) {
        result.trace = trace(context, result.trace, `$exists: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) does ${results?.[1]?.value ? "not " : ""}exist`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$exists: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) does ${results?.[1]?.value ? "" : "not "}exist`);
      }

      return result;
    }
  },

  nonnull: {
    name: "nonnull",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.nonnull, args, row, context);

      const result1 = results?.[0]?.value !== undefined && (results?.[0]?.value === null) === !(results?.[1]?.value ?? true);

      const result = {
        trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [],
        value: result1
      }

      if (!result.value) {
        result.trace = trace(context, result.trace, `$nonnull: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is ${results?.[1]?.value ? "" : "not "}null`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$nonnull: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not null`);
      }

      return result;
    }
  },

  bitsAllSet: {
    name: "bitsAllSet",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.bitsAllSet, args, row, context);

      const arg1 = parseInt(results?.[0]?.value);
      const arg2 = parseInt(results?.[1]?.value);

      Number.isNaN(arg1) && raise(`$bitsAllSet failed. arg1 not an int: ${util.toString(results?.[0]?.value)}`);
      Number.isNaN(arg2) && raise(`$bitsAllSet failed. arg2 not an int: ${util.toString(results?.[1]?.value)}`);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: arg1 & arg2 };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$bitsAllSet: all bits not set: ${results[0]?.value} & ${results[1]?.value}`);
      }

      return result;
    }
  },

  bitsAllClear: {
    name: "bitsAllClear",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.bitsAllClear, args, row, context);

      const arg1 = parseInt(results?.[0]?.value);
      const arg2 = parseInt(results?.[1]?.value);

      Number.isNaN(arg1) && raise(`$bitsAllClear failed. arg1 not an int: ${util.toString(results?.[0]?.value)}`);
      Number.isNaN(arg2) && raise(`$bitsAllClear failed. arg2 not an int: ${util.toString(results?.[1]?.value)}`);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: (arg1 & arg2) === 0 };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$bitsAllClear: all bits not clear: ${results[0]} : ${results[1]}`);
      }

      return result;
    }
  },

  bitsAnySet: {
    name: "bitsAnySet",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.bitsAnySet, args, row, context);

      const arg1 = parseInt(results?.[0]?.value);
      const arg2 = parseInt(results?.[1]?.value);

      Number.isNaN(arg1) && raise(`$bitsAnySet failed. arg1 not an int: ${util.toString(results?.[0]?.value)}`);
      Number.isNaN(arg2) && raise(`$bitsAnySet failed. arg2 not an int: ${util.toString(results?.[1]?.value)}`);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: (arg1 & arg2) !== 0 };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$bitsAnySet: no bits set: ${arg1} & ${arg2}`);
      }

      return result;
    }
  },

  bitsAnyClear: {
    name: "bitsAnyClear",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.bitsAnyClear, args, row, context);

      const arg1 = parseInt(results?.[0]?.value);
      const arg2 = parseInt(results?.[1]?.value);

      Number.isNaN(arg1) && raise(`$bitsAnyClear failed. arg1 not an int: ${util.toString(results?.[0]?.value)}`);
      Number.isNaN(arg2) && raise(`$bitsAnyClear failed. arg2 not an int: ${util.toString(results?.[1]?.value)}`);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: (~arg1 & arg2) !== 0 };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$bitsAnyClear: no bits clear: ${arg1} & ${arg2}`);
      }

      return result;
    }
  },

  set: {
    name: "set",
    rhs: true,
    expandField: false,
    func: (context, row, ...args) => {
      context?.operator !== Operators.set && !(Object.keys(args?.[0])?.length > 0) && raise("$set: nothing to be set.");

      const result = {
        trace: [],
        value: args?.length > 1 ? { [args?.[0]]: Array.isArray(args?.[1]) ? [] : {} } : context?.inline === false ? Array.isArray(args?.[1]) ? [] : {} : row
      };

      const argNonPrimitive = ["array", "object"].includes(util.typeOf(args[1]));

      const arg = args?.length > 1 ? argNonPrimitive ? args[1] : { [args[0]]: null } : args[0];

      for (const key of Object.keys(arg)) {
        const value = args?.length > 1 ? argNonPrimitive ? args?.[1][key] : args[1] : args[0][key];
        const keyValue = evaluate(key, row, context);
        result.trace = trace(context, result.trace, keyValue?.trace);

        if (keyValue?.value != null) {
          let setValue;
          if (typeof value === "function") {
            setValue = { value: value(row) }
          } else {
            setValue = evaluate(value, row, { operator: Operators.set });
            result.trace = trace(context, result.trace, setValue?.trace);
          }

          const resolvedKey = args?.length > 1 && argNonPrimitive ? `${args[0]}.${keyValue.value}` : keyValue.value;
          if (setValue.value !== undefined) {
            if (resolvedKey.includes("[]")) {
              ext.setValueForKeypath(result.value, resolvedKey, setValue.value);
            } else {
              ext.mergeWith(result.value, ext.setValueForKeypath({}, resolvedKey, setValue.value));
            }
          } else {
            delete result.value[resolvedKey];
          }
        }
      }

      return result;
    }
  },

  addFields: {
    name: "addFields",
    alias: "set"
  },

  project: {
    name: "project",
    expandField: false,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.project, args, row, ({ ...(context ?? {}), operator: Operators.set }), 1);
      const arg1 = results?.[0];
      !util.isObject(arg1.value) && raise(`$project failed: first arg not an object: ${util.toString(arg1.value)}`);

      const arg2 = results?.[1];
      arg2?.value != null && ![true, false].includes(arg2.value) && raise(`$project failed: second arg not a boolean: ${util.toString(arg2.value)} `);

      const filter = [];
      const result = { trace: arg1.trace ?? [], value: row ?? {} };
      const replace = !!arg2?.value;
      for (const [key, value] of Object.entries(arg1.value)) {
        switch (value) {
          case 0:
          case false:
            delete result.value[key];
            break;
          case 1:
          case true:
            filter.push(key);
            break;
          default: {
            const result1 = evaluate(value, row, context);
            if (replace) {
              filter.push(key);
            }
            ext.setValueForKeypath(row, key, result1?.value);
            result.trace = trace(context, result.trace, result1?.trace);
            break;
          }
        }
      }

      if (filter.length) {
        Object.keys(result.value).forEach(key => {
          if (!filter.includes(key)) {
            delete result.value[key];
          }
        })
      }

      return {
        trace: result.trace,
        value: context?.operator === Operators.set ? result.value : Object.keys(result.value).length > 0 ? true : undefined
      }
    }
  },

  unset: {
    name: "unset",
    expandField: false,
    func: (_context, row, ...args) => {
      const fields = Array.isArray(args?.[0]) ? args[0] : [args?.[0]];
      fields.forEach(f => typeof f !== "string" && raise(`$unset: field names must be strings: ${util.toString(f)}`));

      const value = ext.klone(row);
      fields.forEach(f => delete value[f]);

      return { value, trace: [] };
    }
  },

  replaceRoot: {
    name: "replaceRoot",
    func: (context, row, ...args) => {
      const result = args?.[0] != null
        ? evaluate({ $set: args?.[0] }, row, { ...(context ?? {}), inline: false, operator: Operators.set })
        : { value: args?.[0] }

      if (result.value != null) {
        ext.replaceWith(row, ext.klone(result?.value));
      }

      return {
        trace: (result.trace ?? []),
        value: result?.value
      }
    }
  },

  replaceWith: {
    name: "replaceWith",
    alias: "replaceRoot"
  },

  cond: {
    name: "cond",
    rhs: true,
    func: (context, row, ...args) => {
      const arg = args?.[0];

      arg?.length !== 3 && raise(`$cond: cond-then-else expected. got ${util.toString(arg)}`);

      const result = evaluate(arg[0], row, { ...context, operator: Operators.eq });
      let result1;

      result.trace ??= [];

      if (result?.value) {
        result1 = evaluate(arg[1], row, context);
      } else {
        result1 = evaluate(arg[2], row, context);
      }

      result.trace = trace(context, result.trace, result1?.trace);

      return { value: result1.value, trace: result.trace };
    }
  },

  switch: {
    name: "switch",
    rhs: true,
    func: (context, row, ...args) => {
      const spec = args?.[0];

      !util.isObject(spec) && raise(`$switch: argument must be an object`);
      !Array.isArray(spec.branches) && raise(`$switch: branches must be an array`);

      let traces = [];

      for (const branch of spec.branches) {
        const cond = evaluate(branch.case, row, context);
        traces = trace(context, traces, cond?.trace);

        if (cond?.value) {
          const then = evaluate(branch.then, row, context);
          traces = trace(context, traces, then?.trace);
          return { value: then?.value, trace: traces };
        }
      }

      typeof spec.default === "undefined" && raise(`$switch: no branch matched and no default specified`);

      const def = evaluate(spec.default, row, context);
      traces = trace(context, traces, def?.trace);

      return { value: def?.value, trace: traces };
    }
  },

  ifNull: {
    name: "ifNull",
    func: (context, row, ...args) => {
      const arg = args?.[0];

      !Array.isArray(arg) && raise(`$ifNull failed. not an array: ${util.toString(arg)}`);

      if (!arg.length) {
        return null;
      }

      const result = { value: null, trace: [] };

      for (const item of arg) {
        const result1 = evaluate(item, row, context);
        result.trace = trace(context, result.trace, result1?.trace);

        if (result1?.value != null) {
          result.value = result1.value;
          break;
        }
      }

      return result;
    }
  },

  not: {
    name: "not",
    func: (context, row, ...args) => {
      let result = getArgs(Operators.not, args, row, context, 1)?.[0];

      if (!util.isObject(result)) {
        result = { value: !result, trace: [] }
      }

      result.value = !result.value;

      return result;
    }
  },

  mergeObjects: {
    name: "mergeObjects",
    func: (context, row, ...args) => {
      !Array.isArray(args?.[0]) && raise(`$mergeObjects failed. arg not an array: ${util.toString(args?.[0])}`);

      const result = {
        trace: [],
        value: null
      };

      result.value = args?.[0].reduce((p, c) => {
        const result1 = typeof c === "string" ? evaluate(c, row, context) : Operators.set.func({ inline: false }, row, c);
        result.trace = trace(context, result.trace, result1?.trace);
        return ext.mergedWith(p, result1?.value);
      }, {});

      return result;
    }
  },

  func: {
    name: "func",
    func: (context, row, ...args) => {
      typeof args?.[0] !== "function" && raise(`$func: first argument must be a function`);
      return args[0]({ ...context, getArgs, getField, getValue, evaluate, trace, logger }, row, args);
    }
  },

  let: {
    name: "let",
    minArgCount: 1,
    func: (context, row, ...args) => {
      context ??= {};

      const spec = args?.[0];

      !util.isObject(spec) && raise(`$let: argument must be an object`);
      !util.isObject(spec.vars) && raise(`$let: vars must be an object`);
      typeof spec.in === "undefined" && raise(`$let: 'in' is required`);

      const childContext = Object.create(context);
      childContext.vars = Object.create(context?.vars ?? null);

      for (const [name, expr] of Object.entries(spec.vars)) {
        childContext.vars[name] = evaluate(expr, row, context)?.value;
      }

      return evaluate(spec.in, row, childContext);
    }
  },

  literal: {
    name: "literal",
    minArgCount: 1,
    rawArg: true,
    func: (_context, _row, ...args) => ({ value: args[0], trace: [] })
  },

};
