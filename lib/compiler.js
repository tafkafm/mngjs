// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import { isVar, getOperator, evaluate } from "./engine.js";
import * as ext from "./extensions.js";

/**
 * Compile an expression into a reusable function (row, vars?) => value.
 * The query tree is walked once here; the returned function is called per row.
 */
export const compileExpr = (expr, compileCtx = {}) => {

  // ── Case 1: $$ROOT / $$CURRENT ─────────────────────────────────────────────
  if (expr === "$$ROOT") {
    return (_row) => ext.klone(_row);
  }

  if (expr === "$$CURRENT") {
    return (row) => row;
  }

  // ── Case 2: Array ───────────────────────────────────────────────────────────
  if (Array.isArray(expr)) {
    const fns = expr.map(item => compileExpr(item, compileCtx));
    return (row, vars) => fns.map(fn => fn(row, vars));
  }

  // ── Case 3: Non-object scalar (string / number / boolean / null) ────────────
  if (expr === null || typeof expr !== "object") {
    if (typeof expr === "string") {
      // _$varName  →  look up in let-scoped vars
      if (expr.startsWith("_$")) {
        const varName = expr.substring(2);
        return (_row, vars) => vars?.[varName];
      }

      const varLen = isVar(expr) ?? 0;

      if (varLen === 2) {
        // $$field  →  double-deref: row[row[field]]
        const path = expr.substring(2);
        return (row) => ext.valueForKeypath(row, ext.valueForKeypath(row, path));
      }

      if (varLen === 1) {
        const name = expr.substring(1);
        // If it's a known operator name, treat the string itself as a literal
        if (getOperator(name)) {
          return (_row) => expr;
        }
        // Otherwise it's a field reference
        return (row) => ext.valueForKeypath(row, name);
      }
    }

    // Plain literal (number, boolean, null, non-$ string)
    return (_row) => expr;
  }

  // Date / RegExp — treat as literal objects
  if (expr instanceof Date || expr instanceof RegExp) {
    return (_row) => expr;
  }

  // ── Case 4: Plain object ────────────────────────────────────────────────────
  const keys = Object.keys(expr);

  if (keys.length === 0) {
    return (_row) => true;
  }

  const fns = [];

  for (const key of keys) {
    const varLen = isVar(key) ?? 0;

    if (varLen >= 1) {
      // ── Operator key  e.g. $eq, $and, $match ─────────────────────────────
      const opName = key.substring(1);
      const op = getOperator(opName);
      const rawArg = expr[key];

      if (op?.compile) {
        fns.push(op.compile(rawArg, compileCtx));
      } else if (op) {
        // Fallback: runtime evaluation for operators without a compile method
        fns.push((row) => op.func({ trace: false }, row, rawArg)?.value);
      } else {
        fns.push((row) => evaluate(expr, row, { trace: false })?.value);
      }

    } else {
      // ── Field key  e.g. "score", "address.city" ───────────────────────────
      const rawVal = expr[key];

      if (
        rawVal !== null &&
        typeof rawVal === "object" &&
        !Array.isArray(rawVal) &&
        !(rawVal instanceof Date) &&
        !(rawVal instanceof RegExp)
      ) {
        const subKeys = Object.keys(rawVal);
        const allOps =
          subKeys.length > 0 &&
          subKeys.every(k => (isVar(k) ?? 0) >= 1 && getOperator(k.substring(1)));

        if (allOps) {
          // e.g. { score: { $gt: 50, $lt: 100 } }
          for (const subKey of subKeys) {
            const opName = subKey.substring(1);
            const op = getOperator(opName);
            const subArg = rawVal[subKey];
            const lhsFn = (row) => ext.valueForKeypath(row, key);
            const rhsFn = compileExpr(subArg, compileCtx);

            if (op?.compile) {
              fns.push(op.compile(subArg, compileCtx, lhsFn, rhsFn));
            } else if (op) {
              // Capture key/subKey/subArg in a closure for the fallback
              const capturedKey = key;
              const capturedSubKey = subKey;
              const capturedSubArg = subArg;
              fns.push((row) =>
                evaluate(
                  { [capturedKey]: { [capturedSubKey]: capturedSubArg } },
                  row,
                  { trace: false }
                )?.value
              );
            }
          }
          continue;
        }
      }

      // Implicit $eq: { field: value }, { field: "$ref" }, { field: "$$ref" }
      const lhsFn = (row) => ext.valueForKeypath(row, key);
      const rhsFn = compileExpr(rawVal, compileCtx);
      fns.push((row, vars) => {
        const l = lhsFn(row);
        const r = rhsFn(row, vars);
        const lv = l != null ? l.valueOf() : l;
        const rv = r != null ? r.valueOf() : r;
        return lv === rv;
      });
    }
  }

  if (fns.length === 0) {
    return (_row) => true;
  }

  if (fns.length === 1) {
    return fns[0];
  }

  return (row, vars) => fns.every(fn => fn(row, vars));
};
