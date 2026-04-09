// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "../utils.js";
import { raise } from "../utils.js";
import { getArgs, setDedupe } from "../engine.js";
import { Operators } from "./registry.js";

export const operatorsSet = {

  setUnion: {
    name: "setUnion",
    minArgCount: 2,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.setUnion, args, row, context);
      results.forEach((r, i) => !Array.isArray(r.value) && raise(`$setUnion: arg ${i} must be an array: ${util.toString(r.value)}`));

      const combined = results.flatMap(r => r.value);
      const traceResult = results.flatMap(r => r.trace ?? []);

      return { value: setDedupe(combined), trace: traceResult };
    }
  },

  setIntersection: {
    name: "setIntersection",
    minArgCount: 2,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.setIntersection, args, row, context);
      results.forEach((r, i) => !Array.isArray(r.value) && raise(`$setIntersection: arg ${i} must be an array: ${util.toString(r.value)}`));

      const traceResult = results.flatMap(r => r.trace ?? []);
      const first = setDedupe(results[0].value);
      const rest = results.slice(1).map(r => r.value);

      return { value: first.filter(item => rest.every(arr => arr.some(x => util.isEqualValue(x, item)))), trace: traceResult };
    }
  },

  setDifference: {
    name: "setDifference",
    minArgCount: 2,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.setDifference, args, row, context);

      !Array.isArray(results[0].value) && raise(`$setDifference: first arg must be an array: ${util.toString(results[0].value)}`);
      !Array.isArray(results[1].value) && raise(`$setDifference: second arg must be an array: ${util.toString(results[1].value)}`);

      const traceResult = results.flatMap(r => r.trace ?? []);
      const value = setDedupe(results[0].value).filter(item => !results[1].value.some(x => util.isEqualValue(x, item)));

      return { value, trace: traceResult };
    }
  },

  setEquals: {
    name: "setEquals",
    minArgCount: 2,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.setEquals, args, row, context);
      results.forEach((r, i) => !Array.isArray(r.value) && raise(`$setEquals: arg ${i} must be an array: ${util.toString(r.value)}`));

      const traceResult = results.flatMap(r => r.trace ?? []);
      const sets = results.map(r => setDedupe(r.value));
      const value = sets.every(s =>
        s.length === sets[0].length && s.every(item => sets[0].some(x => util.isEqualValue(x, item)))
      );

      return { value, trace: traceResult };
    }
  },

  setIsSubset: {
    name: "setIsSubset",
    minArgCount: 2,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.setIsSubset, args, row, context);

      !Array.isArray(results[0].value) && raise(`$setIsSubset: first arg must be an array: ${util.toString(results[0].value)}`);
      !Array.isArray(results[1].value) && raise(`$setIsSubset: second arg must be an array: ${util.toString(results[1].value)}`);

      const traceResult = results.flatMap(r => r.trace ?? []);
      const value = results[0].value.every(item => results[1].value.some(x => util.isEqualValue(x, item)));

      return { value, trace: traceResult };
    }
  },

  allElementsTrue: {
    name: "allElementsTrue",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.allElementsTrue, args, row, context)?.[0];

      !Array.isArray(result1.value) && raise(`$allElementsTrue: arg must be an array: ${util.toString(result1.value)}`);

      return { value: result1.value.every(x => !!x), trace: result1.trace ?? [] };
    }
  },

  anyElementTrue: {
    name: "anyElementTrue",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.anyElementTrue, args, row, context)?.[0];

      !Array.isArray(result1.value) && raise(`$anyElementTrue: arg must be an array: ${util.toString(result1.value)}`);

      return { value: result1.value.some(x => !!x), trace: result1.trace ?? [] };
    }
  },

};
