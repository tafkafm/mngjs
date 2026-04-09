// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

/**
 * compile.js — adds `.compile` methods to operators already registered in
 * Operators.  Import this module once (after operators/index.js) to enable
 * compiled-query support.
 *
 * Nothing in this file alters the interpreted path (`Query`, `Aggregate`,
 * `Explain`).  It only adds an optional `compile` property to each operator
 * object so that `compileExpr` can use a fast compile-time closure instead of
 * falling back to the full runtime `evaluate` path.
 */

import { compileExpr } from "../compiler.js";
import { isVar } from "../engine.js";
import { Operators } from "./registry.js";
import deepEqual from "fast-deep-equal";

// ---------------------------------------------------------------------------
// Tiny helper
// ---------------------------------------------------------------------------

const valueOf = (v) => (v != null ? v.valueOf() : v);

/**
 * When an operator is used as a plain operator-key (e.g. `{ $eq: ["$a","$b"] }`)
 * `lhsFn` / `rhsFn` are undefined and we derive them from the array arg.
 *
 * When used under a field-key (e.g. `{ score: { $gt: 50 } }`) the caller
 * pre-builds lhsFn/rhsFn and passes them in.
 */
const unpackArgs = (rawArg, compileCtx, lhsFn, rhsFn) => {
  if (lhsFn && rhsFn) return [lhsFn, rhsFn];
  const [lhsExpr, rhsExpr] = Array.isArray(rawArg) ? rawArg : [rawArg, undefined];
  return [compileExpr(lhsExpr, compileCtx), compileExpr(rhsExpr, compileCtx)];
};

// ---------------------------------------------------------------------------
// Compile map
// ---------------------------------------------------------------------------

const compileMap = {

  // ── Comparison ─────────────────────────────────────────────────────────────

  eq: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => valueOf(l(row, vars)) === valueOf(r(row, vars));
  },

  ne: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => valueOf(l(row, vars)) !== valueOf(r(row, vars));
  },

  gt: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => valueOf(l(row, vars)) > valueOf(r(row, vars));
  },

  gte: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => valueOf(l(row, vars)) >= valueOf(r(row, vars));
  },

  lt: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => valueOf(l(row, vars)) < valueOf(r(row, vars));
  },

  lte: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => valueOf(l(row, vars)) <= valueOf(r(row, vars));
  },

  // ── Membership ─────────────────────────────────────────────────────────────

  in: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => {
      const arr = r(row, vars);
      return Array.isArray(arr) && arr.includes(valueOf(l(row, vars)));
    };
  },

  nin: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => {
      const arr = r(row, vars);
      return !Array.isArray(arr) || !arr.includes(valueOf(l(row, vars)));
    };
  },

  // ── Regex ──────────────────────────────────────────────────────────────────

  regex: (rawArg, ctx, lhsFn, rhsFn) => {
    if (lhsFn && rhsFn) {
      // field-key style: lhsFn already resolves the field
      return (row, vars) => {
        const str = String(lhsFn(row, vars) ?? "");
        const pat = rhsFn(row, vars);
        return !!str.match(pat instanceof RegExp ? pat : new RegExp(pat));
      };
    }

    const [lhsExpr, rhsExpr] = Array.isArray(rawArg) ? rawArg : [rawArg, undefined];
    const lFn = compileExpr(lhsExpr, ctx);

    // Pre-compile regex if the pattern is a literal
    if (typeof rhsExpr === "string") {
      const re = new RegExp(rhsExpr);
      return (row, vars) => !!String(lFn(row, vars) ?? "").match(re);
    }
    if (rhsExpr instanceof RegExp) {
      return (row, vars) => !!String(lFn(row, vars) ?? "").match(rhsExpr);
    }
    if (Array.isArray(rhsExpr) && rhsExpr.length >= 1) {
      const re = new RegExp(rhsExpr[0], rhsExpr[1] ?? "");
      return (row, vars) => !!String(lFn(row, vars) ?? "").match(re);
    }

    const rFn = compileExpr(rhsExpr, ctx);
    return (row, vars) => {
      const str = String(lFn(row, vars) ?? "");
      const pat = rFn(row, vars);
      return !!str.match(pat instanceof RegExp ? pat : new RegExp(pat));
    };
  },

  // ── Existence / non-null ────────────────────────────────────────────────────

  exists: (rawArg, ctx, lhsFn, rhsFn) => {
    if (!lhsFn) {
      const [lhsExpr, rhsExpr] = Array.isArray(rawArg) ? rawArg : [rawArg, undefined];
      lhsFn = compileExpr(lhsExpr, ctx);
      rhsFn = rhsExpr !== undefined ? compileExpr(rhsExpr, ctx) : null;
    }
    return (row, vars) => {
      const val = lhsFn(row, vars);
      const shouldExist = rhsFn ? !!valueOf(rhsFn(row, vars)) : true;
      return (val === undefined) === !shouldExist;
    };
  },

  nonnull: (rawArg, ctx, lhsFn, rhsFn) => {
    if (!lhsFn) {
      const [lhsExpr, rhsExpr] = Array.isArray(rawArg) ? rawArg : [rawArg, undefined];
      lhsFn = compileExpr(lhsExpr, ctx);
      rhsFn = rhsExpr !== undefined ? compileExpr(rhsExpr, ctx) : null;
    }
    return (row, vars) => {
      const val = lhsFn(row, vars);
      const shouldBeNonNull = rhsFn ? !!valueOf(rhsFn(row, vars)) : true;
      return val !== undefined && (val === null) === !shouldBeNonNull;
    };
  },

  // ── Logical ────────────────────────────────────────────────────────────────

  not: (rawArg, ctx) => {
    const inner = compileExpr(rawArg, ctx);
    return (row, vars) => !inner(row, vars);
  },

  and: (rawArg, ctx) => {
    if (!Array.isArray(rawArg)) throw new Error("$and: expected array");
    const fns = rawArg.map(c => compileExpr(c, ctx));
    return (row, vars) => fns.every(fn => fn(row, vars));
  },

  or: (rawArg, ctx) => {
    if (!Array.isArray(rawArg)) throw new Error("$or: expected array");
    const fns = rawArg.map(c => compileExpr(c, ctx));
    return (row, vars) => fns.some(fn => fn(row, vars));
  },

  nor: (rawArg, ctx) => {
    if (!Array.isArray(rawArg)) throw new Error("$nor: expected array");
    const fns = rawArg.map(c => compileExpr(c, ctx));
    return (row, vars) => !fns.some(fn => fn(row, vars));
  },

  match: (rawArg, ctx) => {
    if (!rawArg || typeof rawArg !== "object") throw new Error("$match: expected object");
    const fns = Object.entries(rawArg).map(([k, v]) => compileExpr({ [k]: v }, ctx));
    return (row, vars) => fns.every(fn => fn(row, vars));
  },

  // ── Deep equality ───────────────────────────────────────────────────────────

  deq: (rawArg, ctx) => {
    const [lhsExpr, rhsExpr] = Array.isArray(rawArg) ? rawArg : [rawArg, undefined];
    const l = compileExpr(lhsExpr, ctx);
    // rhsExpr may be a literal plain object (e.g. { a:1, b:2 }) used as a
    // value to compare against, not a sub-query.  Detect this: if no key
    // starts with "$" it is a literal document, not an operator expression.
    const rIsLiteral =
      rhsExpr !== null &&
      typeof rhsExpr === "object" &&
      !Array.isArray(rhsExpr) &&
      !(rhsExpr instanceof Date) &&
      !(rhsExpr instanceof RegExp) &&
      Object.keys(rhsExpr).every(k => (isVar(k) ?? 0) === 0);
    const r = rIsLiteral ? () => rhsExpr : compileExpr(rhsExpr, ctx);
    return (row, vars) => deepEqual(l(row, vars), r(row, vars));
  },

  // ── Control flow ───────────────────────────────────────────────────────────

  cond: (rawArg, ctx) => {
    if (!Array.isArray(rawArg) || rawArg.length !== 3) {
      throw new Error("$cond: expected [condition, then, else]");
    }
    const [ce, te, ee] = rawArg;
    const cf = compileExpr(ce, ctx);
    const tf = compileExpr(te, ctx);
    const ef = compileExpr(ee, ctx);
    return (row, vars) => cf(row, vars) ? tf(row, vars) : ef(row, vars);
  },

  ifNull: (rawArg, ctx) => {
    if (!Array.isArray(rawArg)) throw new Error("$ifNull: expected array");
    const fns = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => {
      for (const fn of fns) {
        const v = fn(row, vars);
        if (v != null) return v;
      }
      return null;
    };
  },

  switch: (rawArg, ctx) => {
    if (!rawArg || !Array.isArray(rawArg.branches)) {
      throw new Error("$switch: expected { branches, default? }");
    }
    const branches = rawArg.branches.map(({ case: ce, then: te }) => ({
      cf: compileExpr(ce, ctx),
      tf: compileExpr(te, ctx)
    }));
    const df = rawArg.default !== undefined ? compileExpr(rawArg.default, ctx) : () => null;
    return (row, vars) => {
      for (const { cf, tf } of branches) {
        if (cf(row, vars)) return tf(row, vars);
      }
      return df(row, vars);
    };
  },

  let: (rawArg, ctx) => {
    if (!rawArg || typeof rawArg !== "object") throw new Error("$let: expected object");
    if (!rawArg.vars || typeof rawArg.vars !== "object") throw new Error("$let: vars must be an object");
    if (rawArg.in === undefined) throw new Error("$let: 'in' is required");

    const varFns = Object.entries(rawArg.vars).map(([n, e]) => [n, compileExpr(e, ctx)]);
    const inFn = compileExpr(rawArg.in, ctx);

    return (row, vars) => {
      const childVars = Object.create(vars ?? null);
      for (const [n, fn] of varFns) {
        childVars[n] = fn(row, vars);
      }
      return inFn(row, childVars);
    };
  },

  literal: (rawArg) => () => rawArg,

  func: (rawArg) => {
    if (typeof rawArg !== "function") throw new Error("$func: expected function");
    // Provide a minimal context that supports evaluate via compileExpr
    return (row, _vars) => {
      const ctx = {
        trace: () => [],
        evaluate: (e, r) => ({ value: compileExpr(e)(r), trace: [] })
      };
      return rawArg(ctx, row)?.value;
    };
  },

  // ── Arithmetic ─────────────────────────────────────────────────────────────

  add: (rawArg, ctx) => {
    const fns = Array.isArray(rawArg)
      ? rawArg.map(e => compileExpr(e, ctx))
      : [compileExpr(rawArg, ctx)];
    return (row, vars) => fns.reduce((s, fn) => s + (fn(row, vars) ?? 0), 0);
  },

  subtract: (rawArg, ctx) => {
    const [a, b] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => (a(row, vars) ?? 0) - (b(row, vars) ?? 0);
  },

  mul: (rawArg, ctx) => {
    const fns = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => fns.reduce((p, fn) => p * (fn(row, vars) ?? 0), 1);
  },

  divide: (rawArg, ctx) => {
    const [a, b] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => (a(row, vars) ?? 0) / (b(row, vars) ?? 1);
  },

  mod: (rawArg, ctx) => {
    const [a, b] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => (a(row, vars) ?? 0) % (b(row, vars) ?? 1);
  },

  pow: (rawArg, ctx) => {
    const [a, b] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => Math.pow(a(row, vars) ?? 0, b(row, vars) ?? 1);
  },

  abs: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.abs(fn(row, vars));
  },

  ceil: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.ceil(fn(row, vars));
  },

  floor: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.floor(fn(row, vars));
  },

  sqrt: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.sqrt(fn(row, vars));
  },

  trunc: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.trunc(fn(row, vars));
  },

  exp: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.exp(fn(row, vars));
  },

  ln: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.log(fn(row, vars));
  },

  log10: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.log10(fn(row, vars));
  },

  log: (rawArg, ctx) => {
    const [a, b] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => Math.log(a(row, vars)) / Math.log(b(row, vars));
  },

  round: (rawArg, ctx) => {
    if (Array.isArray(rawArg)) {
      const [a, b] = rawArg.map(e => compileExpr(e, ctx));
      return (row, vars) => {
        const p = Math.pow(10, b(row, vars) ?? 0);
        return Math.round((a(row, vars) ?? 0) * p) / p;
      };
    }
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Math.round(fn(row, vars));
  },

  // ── Aggregation (array or field) ────────────────────────────────────────────

  sum: (rawArg, ctx) => {
    if (Array.isArray(rawArg)) {
      const fns = rawArg.map(e => compileExpr(e, ctx));
      return (row, vars) => fns.reduce((s, fn) => s + (fn(row, vars) ?? 0), 0);
    }
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => {
      const arr = fn(row, vars);
      return Array.isArray(arr) ? arr.reduce((s, x) => s + (x ?? 0), 0) : (arr ?? 0);
    };
  },

  avg: (rawArg, ctx) => {
    if (Array.isArray(rawArg)) {
      const fns = rawArg.map(e => compileExpr(e, ctx));
      return (row, vars) => {
        const vals = fns.map(fn => fn(row, vars));
        return vals.reduce((s, x) => s + (x ?? 0), 0) / vals.length;
      };
    }
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => {
      const arr = fn(row, vars);
      return Array.isArray(arr) && arr.length
        ? arr.reduce((s, x) => s + (x ?? 0), 0) / arr.length
        : null;
    };
  },

  min: (rawArg, ctx) => {
    if (Array.isArray(rawArg)) {
      const fns = rawArg.map(e => compileExpr(e, ctx));
      return (row, vars) => Math.min(...fns.map(fn => fn(row, vars)));
    }
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => {
      const arr = fn(row, vars);
      return Array.isArray(arr) ? arr.reduce((m, x) => (x < m ? x : m), arr[0]) : null;
    };
  },

  max: (rawArg, ctx) => {
    if (Array.isArray(rawArg)) {
      const fns = rawArg.map(e => compileExpr(e, ctx));
      return (row, vars) => Math.max(...fns.map(fn => fn(row, vars)));
    }
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => {
      const arr = fn(row, vars);
      return Array.isArray(arr) ? arr.reduce((m, x) => (x > m ? x : m), arr[0]) : null;
    };
  },

  // ── String ─────────────────────────────────────────────────────────────────

  toLower: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => String(fn(row, vars) ?? "").toLowerCase();
  },

  toUpper: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => String(fn(row, vars) ?? "").toUpperCase();
  },

  toString: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => String(fn(row, vars) ?? "");
  },

  strLenCP: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => String(fn(row, vars) ?? "").length;
  },

  // ── Type conversion / inspection ───────────────────────────────────────────

  isArray: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => Array.isArray(fn(row, vars));
  },

  isNumber: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => typeof fn(row, vars) === "number";
  },

  isString: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => typeof fn(row, vars) === "string";
  },

  isObject: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => {
      const v = fn(row, vars);
      return v !== null && typeof v === "object" && !Array.isArray(v);
    };
  },

  isDate: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => fn(row, vars) instanceof Date;
  },

  toInt: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => parseInt(fn(row, vars));
  },

  toDouble: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => parseFloat(fn(row, vars));
  },

  toBool: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => !!fn(row, vars);
  },

  toDate: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => new Date(fn(row, vars));
  },

  // ── Trigonometric ──────────────────────────────────────────────────────────

  ...Object.fromEntries(
    ["sin","cos","tan","asin","acos","atan","sinh","cosh","tanh","asinh","acosh","atanh"].map(name => [
      name, (rawArg, ctx) => {
        const fn = compileExpr(rawArg, ctx);
        return (row, vars) => Math[name](fn(row, vars));
      }
    ])
  ),

  atan2: (rawArg, ctx) => {
    const [y, x] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => Math.atan2(y(row, vars), x(row, vars));
  },

  degreesToRadians: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => fn(row, vars) * (Math.PI / 180);
  },

  radiansToDegrees: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => fn(row, vars) * (180 / Math.PI);
  },

  // ── Comparison expression ──────────────────────────────────────────────────

  cmp: (rawArg, ctx, lhsFn, rhsFn) => {
    const [l, r] = unpackArgs(rawArg, ctx, lhsFn, rhsFn);
    return (row, vars) => {
      const a = valueOf(l(row, vars)), b = valueOf(r(row, vars));
      return a < b ? -1 : a > b ? 1 : 0;
    };
  },

  // ── Bitwise ────────────────────────────────────────────────────────────────

  bitAnd: (rawArg, ctx) => {
    const [a, b] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => a(row, vars) & b(row, vars);
  },

  bitOr: (rawArg, ctx) => {
    const [a, b] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => a(row, vars) | b(row, vars);
  },

  bitXor: (rawArg, ctx) => {
    const [a, b] = rawArg.map(e => compileExpr(e, ctx));
    return (row, vars) => a(row, vars) ^ b(row, vars);
  },

  bitNot: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => ~fn(row, vars);
  },

  rand: () => () => Math.random(),

  // ── String ─────────────────────────────────────────────────────────────────

  regexMatch: (rawArg, ctx, lhsFn, rhsFn) => {
    if (lhsFn && rhsFn) {
      return (row, vars) => new RegExp(rhsFn(row, vars)).test(String(lhsFn(row, vars) ?? ""));
    }
    const [lhsExpr, rhsExpr] = Array.isArray(rawArg) ? rawArg : [rawArg, undefined];
    const lFn = compileExpr(lhsExpr, ctx);
    if (typeof rhsExpr === "string") {
      const re = new RegExp(rhsExpr);
      return (row, vars) => re.test(String(lFn(row, vars) ?? ""));
    }
    const rFn = compileExpr(rhsExpr, ctx);
    return (row, vars) => new RegExp(rFn(row, vars)).test(String(lFn(row, vars) ?? ""));
  },

  // ── Array ops ──────────────────────────────────────────────────────────────

  size: (rawArg, ctx) => {
    const fn = compileExpr(rawArg, ctx);
    return (row, vars) => {
      const arr = fn(row, vars);
      return Array.isArray(arr) ? arr.length : null;
    };
  },
};

// ---------------------------------------------------------------------------
// Mix compile methods into Operators
// ---------------------------------------------------------------------------

for (const [name, compile] of Object.entries(compileMap)) {
  if (Operators[name]) {
    Operators[name].compile = compile;
  }
}

// multiply is an alias for mul — getOperator resolves the alias, so registering
// on the base name is sufficient.  But add it explicitly for clarity:
if (Operators.multiply && !Operators.multiply.compile) {
  Operators.multiply.compile = compileMap.mul;
}

// Trig operators are registered dynamically via Object.fromEntries in compileMap;
// the loop above already handles them since their names match Operators keys.
