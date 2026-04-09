// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "../utils.js";
import { raise } from "../utils.js";
import { getArgs, evaluate, isVar } from "../engine.js";
import { Operators } from "./registry.js";

export const operatorsArithmetic = {

  add: {
    name: "add",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.add, args, row, context);

      const arg1 = results?.[0];
      typeof arg1.value !== "number" && raise(`$add failed: arg1 must be a number: ${util.toString(arg1.value)}`);

      const arg2 = results?.[1];
      typeof arg2.value !== "number" && raise(`$add failed: arg2 must be a number: ${util.toString(arg2.value)}`);

      return { value: arg1.value + arg2.value, trace: arg1.trace?.concat(arg2.trace ?? []) ?? [] };
    }
  },

  subtract: {
    name: "subtract",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.subtract, args, row, context);

      const arg1 = results?.[0];
      typeof arg1.value !== "number" && raise(`$subtract failed: arg1 must be a number: ${util.toString(arg1.value)}`);

      const arg2 = results?.[1];
      typeof arg2.value !== "number" && raise(`$subtract failed: arg2 must be a number: ${util.toString(arg2.value)}`);

      return { value: arg1.value - arg2.value, trace: arg1.trace?.concat(arg2.trace ?? []) ?? [] };
    }
  },

  mul: {
    name: "mul",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.mul, args, row, context);

      const arg1 = results?.[0];
      !Number.isInteger(arg1.value) && raise(`$mul failed: arg1 must be an integer: ${util.toString(arg1.value)}`);

      const arg2 = results?.[1];
      !Number.isInteger(arg2.value) && raise(`$mul failed: arg2 must be an integer: ${util.toString(arg2.value)}`);

      const traceResult = arg1.trace?.concat(arg2.trace ?? []) ?? [];

      return {
        value: arg1.value * arg2.value,
        trace: traceResult
      };
    }
  },

  divide: {
    name: "divide",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.divide, args, row, context);

      const arg1 = results?.[0];
      typeof arg1.value !== "number" && raise(`$divide failed: arg1 must be a number: ${util.toString(arg1.value)}`);

      const arg2 = results?.[1];
      typeof arg2.value !== "number" && raise(`$divide failed: arg2 must be a number: ${util.toString(arg2.value)}`);
      arg2.value === 0 && raise(`$divide failed: division by zero`);

      return { value: arg1.value / arg2.value, trace: arg1.trace?.concat(arg2.trace ?? []) ?? [] };
    }
  },

  mod: {
    name: "mod",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.mod, args, row, context);

      const arg1 = results?.[0];
      typeof arg1.value !== "number" && raise(`$mod failed: arg1 must be a number: ${util.toString(arg1.value)}`);

      const arg2 = results?.[1];
      typeof arg2.value !== "number" && raise(`$mod failed: arg2 must be a number: ${util.toString(arg2.value)}`);
      arg2.value === 0 && raise(`$mod failed: division by zero`);

      return { value: arg1.value % arg2.value, trace: arg1.trace?.concat(arg2.trace ?? []) ?? [] };
    }
  },

  pow: {
    name: "pow",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.pow, args, row, context);

      const arg1 = results?.[0];
      typeof arg1.value !== "number" && raise(`$pow failed: arg1 must be a number: ${util.toString(arg1.value)}`);

      const arg2 = results?.[1];
      typeof arg2.value !== "number" && raise(`$pow failed: arg2 must be a number: ${util.toString(arg2.value)}`);

      return { value: Math.pow(arg1.value, arg2.value), trace: arg1.trace?.concat(arg2.trace ?? []) ?? [] };
    }
  },

  abs: {
    name: "abs",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.abs, args, row, context)?.[0];
      typeof result1.value !== "number" && raise(`$abs failed: arg must be a number: ${util.toString(result1.value)}`);

      return { value: Math.abs(result1.value), trace: result1.trace ?? [] };
    }
  },

  ceil: {
    name: "ceil",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.ceil, args, row, context)?.[0];
      typeof result1.value !== "number" && raise(`$ceil failed: arg must be a number: ${util.toString(result1.value)}`);

      return { value: Math.ceil(result1.value), trace: result1.trace ?? [] };
    }
  },

  floor: {
    name: "floor",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.floor, args, row, context)?.[0];
      typeof result1.value !== "number" && raise(`$floor failed: arg must be a number: ${util.toString(result1.value)}`);

      return { value: Math.floor(result1.value), trace: result1.trace ?? [] };
    }
  },

  round: {
    name: "round",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.round, args, row, context);

      const arg1 = results?.[0];

      const places = results?.[1]?.value ?? 0;
      typeof arg1.value !== "number" && raise(`$round failed: arg must be a number: ${util.toString(arg1.value)}`);
      !Number.isInteger(places) && raise(`$round failed: decimal places must be an integer: ${util.toString(places)}`);

      const factor = Math.pow(10, places);

      return { value: Math.round(arg1.value * factor) / factor, trace: arg1.trace ?? [] };
    }
  },

  sqrt: {
    name: "sqrt",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.sqrt, args, row, context)?.[0];
      typeof result1.value !== "number" && raise(`$sqrt failed: arg must be a number: ${util.toString(result1.value)}`);
      result1.value < 0 && raise(`$sqrt failed: arg must be non-negative: ${util.toString(result1.value)}`);
      return { value: Math.sqrt(result1.value), trace: result1.trace ?? [] };
    }
  },

  trunc: {
    name: "trunc",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.trunc, args, row, context);
      const arg1 = results?.[0];
      const places = results?.[1]?.value ?? 0;
      typeof arg1.value !== "number" && raise(`$trunc failed: arg must be a number: ${util.toString(arg1.value)}`);
      !Number.isInteger(places) && raise(`$trunc failed: decimal places must be an integer: ${util.toString(places)}`);
      const factor = Math.pow(10, places);
      return { value: Math.trunc(arg1.value * factor) / factor, trace: arg1.trace ?? [] };
    }
  },

  exp: {
    name: "exp",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.exp, args, row, context)?.[0];
      typeof result1.value !== "number" && raise(`$exp failed: arg must be a number: ${util.toString(result1.value)}`);
      return { value: Math.exp(result1.value), trace: result1.trace ?? [] };
    }
  },

  ln: {
    name: "ln",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.ln, args, row, context)?.[0];
      typeof result1.value !== "number" && raise(`$ln failed: arg must be a number: ${util.toString(result1.value)}`);
      result1.value <= 0 && raise(`$ln failed: arg must be positive: ${util.toString(result1.value)}`);
      return { value: Math.log(result1.value), trace: result1.trace ?? [] };
    }
  },

  log: {
    name: "log",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.log, args, row, context);
      const arg1 = results?.[0];
      const base = results?.[1];
      typeof arg1.value !== "number" && raise(`$log failed: arg must be a number: ${util.toString(arg1.value)}`);
      typeof base.value !== "number" && raise(`$log failed: base must be a number: ${util.toString(base.value)}`);
      arg1.value <= 0 && raise(`$log failed: arg must be positive: ${util.toString(arg1.value)}`);
      base.value <= 0 || base.value === 1 && raise(`$log failed: base must be positive and not 1: ${util.toString(base.value)}`);
      return { value: Math.log(arg1.value) / Math.log(base.value), trace: arg1.trace?.concat(base.trace ?? []) ?? [] };
    }
  },

  log10: {
    name: "log10",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.log10, args, row, context)?.[0];
      typeof result1.value !== "number" && raise(`$log10 failed: arg must be a number: ${util.toString(result1.value)}`);
      result1.value <= 0 && raise(`$log10 failed: arg must be positive: ${util.toString(result1.value)}`);
      return { value: Math.log10(result1.value), trace: result1.trace ?? [] };
    }
  },

  sum: {
    name: "sum",
    func: (context, row, ...args) => {
      const result = evaluate(args?.[1] ?? args?.[0], row, context);

      const traceResult = result?.trace ?? [];

      result?.value != null && !Array.isArray(result?.value) && !isVar(result?.value) && raise(`$max failed. neither an array nor a field name: ${util.toString(result?.value)}`);

      return {
        value: result?.value?.reduce((p, c) => p + c, 0),
        trace: traceResult
      };
    }
  },

  avg: {
    name: "avg",
    func: (context, row, ...args) => {
      const result1 = evaluate(args?.[1] ?? args?.[0], row, context);
      const traceResult = result1?.trace ?? [];

      !Array.isArray(result1?.value) && raise(`$avg failed. not an array: ${util.toString(result1?.value)}`);

      let value = result1.value.reduce((p, c) => p + c, 0);
      if (result1.value.length > 0) {
        value /= result1.value.length;
      }

      return {
        value,
        trace: traceResult
      };
    }
  },

  min: {
    name: "min",
    func: (context, row, ...args) => {
      const result = evaluate(args?.[1] ?? args?.[0], row, context);
      const traceResult = result?.trace ?? [];

      !Array.isArray(result?.value) && !isVar(result?.value) && raise(`$min failed. neither an array nor a field name: ${util.toString(result?.value)}`);

      return {
        value: !result.value.length ? null : Math.min(...result.value),
        trace: traceResult
      };
    }
  },

  max: {
    name: "max",
    func: (context, row, ...args) => {
      const result = evaluate(args?.[0], row, context);
      const traceResult = result?.trace ?? [];

      !Array.isArray(result?.value) && !isVar(result?.value) && raise(`$max failed. neither an array nor a field name: ${util.toString(result?.value)}`);

      return {
        value: !result.value.length ? null : Math.max(...result.value),
        trace: traceResult
      };
    }
  },

  // ── Trigonometric ──────────────────────────────────────────────────────────

  /**
   * Trig and hyperbolic trig operators — each accepts a single numeric
   * expression (in radians) and delegates to the corresponding `Math.*` function.
   */
  ...Object.fromEntries(
    ["sin","cos","tan","asin","acos","atan","sinh","cosh","tanh","asinh","acosh","atanh"].map(name => [
      name, {
        name,
        minArgCount: 1,
        func: (context, row, ...args) => {
          const r = getArgs(Operators[name], args, row, context)?.[0];
          typeof r.value !== "number" && raise(`$${name} failed: arg must be a number: ${util.toString(r.value)}`);
          return { value: Math[name](r.value), trace: r.trace ?? [] };
        }
      }
    ])
  ),

  atan2: {
    name: "atan2",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.atan2, args, row, context);
      const y = results?.[0];
      const x = results?.[1];
      typeof y.value !== "number" && raise(`$atan2 failed: y must be a number: ${util.toString(y.value)}`);
      typeof x.value !== "number" && raise(`$atan2 failed: x must be a number: ${util.toString(x.value)}`);
      return { value: Math.atan2(y.value, x.value), trace: y.trace?.concat(x.trace ?? []) ?? [] };
    }
  },

  // ── Angle conversion ───────────────────────────────────────────────────────

  degreesToRadians: {
    name: "degreesToRadians",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const r = getArgs(Operators.degreesToRadians, args, row, context)?.[0];
      typeof r.value !== "number" && raise(`$degreesToRadians failed: arg must be a number: ${util.toString(r.value)}`);
      return { value: r.value * (Math.PI / 180), trace: r.trace ?? [] };
    }
  },

  radiansToDegrees: {
    name: "radiansToDegrees",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const r = getArgs(Operators.radiansToDegrees, args, row, context)?.[0];
      typeof r.value !== "number" && raise(`$radiansToDegrees failed: arg must be a number: ${util.toString(r.value)}`);
      return { value: r.value * (180 / Math.PI), trace: r.trace ?? [] };
    }
  },

  // ── Comparison expression ──────────────────────────────────────────────────

  cmp: {
    name: "cmp",
    rhs: true,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.cmp, args, row, context);
      const a = results?.[0]?.value?.valueOf();
      const b = results?.[1]?.value?.valueOf();
      const value = a < b ? -1 : a > b ? 1 : 0;
      return { value, trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [] };
    }
  },

  // ── Bitwise expression operators ───────────────────────────────────────────

  bitAnd: {
    name: "bitAnd",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.bitAnd, args, row, context);
      return { value: results[0].value & results[1].value, trace: results[0].trace?.concat(results[1].trace ?? []) ?? [] };
    }
  },

  bitOr: {
    name: "bitOr",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.bitOr, args, row, context);
      return { value: results[0].value | results[1].value, trace: results[0].trace?.concat(results[1].trace ?? []) ?? [] };
    }
  },

  bitXor: {
    name: "bitXor",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.bitXor, args, row, context);
      return { value: results[0].value ^ results[1].value, trace: results[0].trace?.concat(results[1].trace ?? []) ?? [] };
    }
  },

  bitNot: {
    name: "bitNot",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const r = getArgs(Operators.bitNot, args, row, context)?.[0];
      return { value: ~r.value, trace: r.trace ?? [] };
    }
  },

  // ── Random ─────────────────────────────────────────────────────────────────

  rand: {
    name: "rand",
    minArgCount: 0,
    func: () => ({ value: Math.random(), trace: [] })
  },

};
