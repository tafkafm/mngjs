// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "../utils.js";
import { raise } from "../utils.js";
import * as ext from "../extensions.js";
import { getArgs, evaluate, trace } from "../engine.js";
import { Operators } from "./registry.js";
import deepEqual from "fast-deep-equal";

export const operatorsArray = {

  size: {
    name: "size",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.size, args, row, context)?.[0];
      !Array.isArray(result1?.value) && raise(`$size failed. not an array: ${util.toString(result1?.value)}`);

      return {
        value: result1.value.length,
        trace: result1?.trace ?? []
      };
    }
  },

  push: {
    name: "push",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.push, args, row, context);

      const array = results?.[0]?.value;
      let value = results?.slice(1)?.map(({ value }) => value).flat();

      !Array.isArray(array) && raise(`$push failed. not an array: ${args?.[0]?.[0]}(${util.toString(array)})`);

      if (context?.operator === Operators.set) {
        value = array.concat(...(context?.spread ? value : [value]));
      } else {
        array.push(...(context?.spread ? Array.isArray(value) ? value : [value] : [value]));
        value = array;
      }

      return {
        value: context?.operator === Operators.set ? value : true,
        trace: (results?.[0]?.trace ?? []).concat(results?.[1]?.trace)
      };
    }
  },

  pop: {
    name: "pop",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.pop, args, row, context, 1);

      const array = results?.[0]?.value;
      const count = results?.[1]?.value ? parseInt(results?.[1]?.value) : 1;

      !Array.isArray(array) && raise(`$pop failed. not an array: ${args?.[0]}(${util.toString(array)})`);
      Number.isNaN(count) && raise(`$pop failed. count arg not a number: ${args?.[1]}(${util.toString(count)})`);

      let value;

      if (context?.operator === Operators.set) {
        value = ext.first(array, 0, array.length - count, true);
      } else {
        array.splice(Math.max(array.length - count, 0), count);
        value = array
      }

      return {
        value: context?.operator === Operators.set ? value : true,
        trace: (results?.[0]?.trace ?? []).concat(results?.[1]?.trace)
      };
    }
  },

  concat: {
    name: "concat",
    func: (context, row, ...args) => Operators.push.func({ ...(context ?? {}), spread: true }, row, ...args)
  },

  concatArrays: {
    name: "concatArrays",
    alias: "concat"
  },

  elemAt: {
    name: "elemAt",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.elemAt, args, row, context);

      const array = results?.[0]?.value;
      !Array.isArray(array) && raise(`$elemAt failed. not an array: ${util.toString(args?.[0])}(${array})`);

      const index = parseInt(results?.[1]?.value);
      Number.isNaN(index) && raise(`$elemAt failed. index arg not a number: ${util.toString(args?.[1])}(${index})`);

      const traceResult = results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [];

      return {
        value: array[index],
        trace: traceResult
      };

    }
  },

  filter: {
    name: "filter",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const spec = args?.[0];
      !util.isObject(spec) && raise(`$filter: argument must be an object`);

      const input = evaluate(spec.input, row, context);
      !Array.isArray(input.value) && raise(`$filter: input must be an array: ${util.toString(input.value)}`);
      typeof spec.cond === "undefined" && raise(`$filter: cond is required`);

      const as = spec.as ?? "this";

      const value = input.value.filter(item => {
        const childRow = Object.create(row);
        childRow[as] = item;

        const result = evaluate(spec.cond, childRow, context);

        return result?.value;
      });

      return { value, trace: input.trace ?? [] };
    }
  },

  map: {
    name: "map",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const spec = args?.[0];
      !util.isObject(spec) && raise(`$map: argument must be an object`);

      const input = evaluate(spec.input, row, context);
      !Array.isArray(input.value) && raise(`$map: input must be an array: ${util.toString(input.value)}`);
      typeof spec.in === "undefined" && raise(`$map: 'in' is required`);

      const as = spec.as ?? "this";
      let traces = input.trace ?? [];

      const value = input.value.map(item => {
        const childRow = Object.create(row);
        childRow[as] = item;

        const result = evaluate(spec.in, childRow, context);
        traces = trace(context, traces, result?.trace);

        return result?.value;
      });

      return { value, trace: traces };
    }
  },

  reduce: {
    name: "reduce",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const spec = args?.[0];
      !util.isObject(spec) && raise(`$reduce: argument must be an object`);

      const input = evaluate(spec.input, row, context);
      !Array.isArray(input.value) && raise(`$reduce: input must be an array: ${util.toString(input.value)}`);
      typeof spec.in === "undefined" && raise(`$reduce: 'in' is required`);

      const initial = evaluate(spec.initialValue, row, context);
      let traces = input.trace?.concat(initial.trace ?? []) ?? [];
      const value = input.value.reduce((acc, item) => {
        const childRow = Object.create(row);

        childRow.value = acc;
        childRow.this = item;

        const result = evaluate(spec.in, childRow, context);
        traces = trace(context, traces, result?.trace);

        return result?.value;
      }, initial.value);

      return { value, trace: traces };
    }
  },

  slice: {
    name: "slice",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.slice, args, row, context);
      const array = results?.[0];
      !Array.isArray(array.value) && raise(`$slice: first arg must be an array: ${util.toString(array.value)}`);
      const second = results?.[1];
      !Number.isInteger(second.value) && raise(`$slice: second arg must be an integer: ${util.toString(second.value)}`);
      const third = results?.[2];
      third?.value != null && !Number.isInteger(third.value) && raise(`$slice: third arg must be an integer: ${util.toString(third.value)}`);
      const value = third?.value != null
        ? array.value.slice(second.value, second.value + third.value)
        : second.value < 0
          ? array.value.slice(second.value)
          : array.value.slice(0, second.value);
      return { value, trace: array.trace ?? [] };
    }
  },

  first: {
    name: "first",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.first, args, row, context);
      const array = results?.[0];
      const n = results?.[1]?.value;

      !Array.isArray(array.value) && raise(`$first: first arg must be an array: ${util.toString(array.value)}`);
      !Number.isInteger(n) && raise(`$first: second arg must be an integer: ${util.toString(n)}`);

      const value = n >= 0
        ? array.value.slice(0, n)
        : array.value.slice(n);

      return { value, trace: array.trace ?? [] };
    }
  },

  reverseArray: {
    name: "reverseArray",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.reverseArray, args, row, context)?.[0];

      !Array.isArray(result1.value) && raise(`$reverseArray: arg must be an array: ${util.toString(result1.value)}`);

      return { value: result1.value.slice().reverse(), trace: result1.trace ?? [] };
    }
  },

  range: {
    name: "range",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.range, args, row, context);
      const start = results?.[0];
      const end = results?.[1];
      const step = results?.[2]?.value ?? 1;

      !Number.isInteger(start.value) && raise(`$range: start must be an integer: ${util.toString(start.value)}`);
      !Number.isInteger(end.value) && raise(`$range: end must be an integer: ${util.toString(end.value)}`);
      !Number.isInteger(step) || step === 0 && raise(`$range: step must be a non-zero integer: ${util.toString(step)}`);

      const value = [];

      for (let i = start.value; step > 0 ? i < end.value : i > end.value; i += step) {
        value.push(i);
      }

      return { value, trace: start.trace?.concat(end.trace ?? []) ?? [] };
    }
  },

  indexOfArray: {
    name: "indexOfArray",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.indexOfArray, args, row, context);
      const array = results?.[0];

      !Array.isArray(array.value) && raise(`$indexOfArray: first arg must be an array: ${util.toString(array.value)}`);

      const search = results?.[1];

      return { value: array.value.findIndex(el => deepEqual(el, search.value)), trace: array.trace?.concat(search.trace ?? []) ?? [] };
    }
  },

  sortArray: {
    name: "sortArray",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const spec = args?.[0];

      !util.isObject(spec) && raise(`$sortArray: argument must be an object`);

      const input = evaluate(spec.input, row, context);
      !Array.isArray(input.value) && raise(`$sortArray: input must be an array: ${util.toString(input.value)}`);

      const sortBy = spec.sortBy;
      (sortBy !== 1 && sortBy !== -1 && !util.isObject(sortBy)) && raise(`$sortArray: sortBy must be 1, -1, or an object: ${util.toString(sortBy)}`);

      const value = (sortBy === 1 || sortBy === -1)
        ? input.value.slice().sort((a, b) => sortBy * (a < b ? -1 : a > b ? 1 : 0))
        : util.multiSort(input.value.slice(), sortBy);

      return { value, trace: input.trace ?? [] };
    }
  },

  zip: {
    name: "zip",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const spec = args?.[0];

      !util.isObject(spec) && raise(`$zip: argument must be an object`);
      !Array.isArray(spec.inputs) && raise(`$zip: inputs must be an array of arrays`);

      const inputs = spec.inputs.map(expr => {
        const result = evaluate(expr, row, context);

        !Array.isArray(result?.value) && raise(`$zip: each input must resolve to an array: ${util.toString(result?.value)}`);

        return result.value;
      });

      const useLongest = spec.useLongestLength ?? false;
      const defaults = spec.defaults ?? [];
      const len = useLongest
        ? Math.max(...inputs.map(a => a.length))
        : Math.min(...inputs.map(a => a.length));

      const value = Array.from({ length: len }, (_, i) =>
        inputs.map((arr, j) => i < arr.length ? arr[i] : (defaults[j] ?? null))
      );

      return { value, trace: [] };
    }
  },

  flatten: {
    name: "flatten",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.flatten, args, row, context);
      const array = results?.[0];
      !Array.isArray(array.value) && raise(`$flatten: first arg must be an array: ${util.toString(array.value)}`);

      const depth = results?.[1]?.value ?? 1;
      !Number.isInteger(depth) && raise(`$flatten: depth must be an integer: ${util.toString(depth)}`);

      return { value: array.value.flat(depth), trace: array.trace ?? [] };
    }
  },

  arrayToObject: {
    name: "arrayToObject",
    func: (context, row, ...args) => {
      const result1 = evaluate(args?.[1] ?? args?.[0], row, context);
      const traceResult = result1?.trace ?? [];

      !Array.isArray(result1?.value) && raise(`$arrayToObject failed. not an array: ${util.toString(result1?.value)}`);

      let value = result1.value.reduce((p, c) => ({ ...p, [c.k]: c.v }), {});

      return {
        value,
        trace: traceResult
      }
    }
  },

  objectToArray: {
    name: "objectToArray",
    func: (context, row, ...args) => {
      const result1 = evaluate(args?.[1] ?? args?.[0], row, context);
      const traceResult = result1?.trace ?? [];

      !util.isObject(result1?.value, false) && raise(`$objectToArray failed. not an object: ${util.toString(result1?.value)}`);

      let value = result1.value ? Object.entries(result1.value).reduce((p, [k, v]) => [...p, { k, v }], []) : result1.value;

      return {
        value,
        trace: traceResult
      }
    }
  },

  in: {
    name: "in",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.in, args, row, context);
      !Array.isArray(results?.[1]?.value) && raise(`$in failed. not an array: ${util.toString(results?.[1]?.value)}`);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: results[1]?.value?.valueOf()?.includes(results[0]?.value?.valueOf()) };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$in: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not in ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$in: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is in ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  nin: {
    name: "nin",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.nin, args, row, context);
      !Array.isArray(results?.[1]?.value) && raise(`$nin failed. not an array: ${util.toString(results?.[1]?.value)}`);

      const result = { trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [], value: !results[1]?.value?.valueOf()?.includes(results[0]?.value?.valueOf()) };
      if (!result.value) {
        result.trace = trace(context, result.trace, `$nin: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is in ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      } else if (context?.forceTrace) {
        result.trace = trace(context, result.trace, `$nin: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${results[0]?.value?.valueOf()}) is not in ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${results[1]?.value?.valueOf()})`);
      }

      return result;
    }
  },

  all: {
    name: "all",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.all, args, row, context);
      const haystack = results?.[0]?.value;
      const needles = results?.[1]?.value;

      !Array.isArray(haystack) && raise(`$all failed. field not an array: ${util.toString(haystack)}`);
      !Array.isArray(needles) && raise(`$all failed. argument not an array: ${util.toString(needles)}`);

      const result = {
        trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [],
        value: needles.every(n => haystack.some(h => deepEqual(h, n)))
      };

      if (!result.value) {
        result.trace = trace(context, result.trace, `$all: ${util.toString(haystack)} does not contain all of ${util.toString(needles)}`);
      }

      return result;
    }
  },

  elemMatch: {
    name: "elemMatch",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.elemMatch, args, row, context);
      const haystack = results?.[0]?.value;
      !Array.isArray(haystack) && raise(`$elemMatch failed. not an array: ${util.toString(haystack)}`);

      const result = { trace: results?.[0]?.trace ?? [], value: false };

      const needle = results?.[1];
      result.trace = trace(context, result.trace, needle?.trace);

      result.value = !!haystack.find(item => {
        const result2 = evaluate(item, row, context);
        result.trace = trace(context, result.trace, result2?.trace);
        return needle?.value === result2?.value;
      });

      if (!result.value) {
        result.trace = trace(context, result.trace, `$elemMatch: ${util.toString(Array.isArray(args[0]) ? args[0][0] : args[0])}(${util.toString(haystack)}) does not contain ${util.toString(Array.isArray(args[0]) ? args[0][1] : args[1])}(${util.toString(needle)})`);
      }

      return result;
    }
  },

};
