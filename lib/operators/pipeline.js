// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "../utils.js";
import { raise } from "../utils.js";
import * as ext from "../extensions.js";
import { getArgs, evaluate, getOperator, isVar } from "../engine.js";
import { Operators, GLOBAL } from "./registry.js";
import deepEqual from "fast-deep-equal";

export const operatorsPipeline = {

  unwind: {
    name: "unwind",
    rhs: true,
    func: (context, row, ...args) => {
      const path = args?.[0]?.path ?? args?.[0];
      typeof path !== "string" && raise(`$unwind failed: no path given`);
      const arg = evaluate(path, row, context);
      const key = path.substring(1);

      const includeArrayIndex = args[0].includeArrayIndex ?? false;
      const preserveNullAndEmptyArrays = args[0].preserveNullAndEmptyArrays ?? false;

      const array =
        Array.isArray(arg.value)
          ? arg.value.length ? arg.value : preserveNullAndEmptyArrays ? [undefined] : []
          : arg.value || preserveNullAndEmptyArrays
            ? [arg.value]
            : [];

      return {
        value:
          array.length
            ? array.map(
              (value, index) => (ext.omit({
                ...row,
                [key]: value,
                ...(includeArrayIndex && array.length > 1 && value != null ? { [includeArrayIndex]: index } : {})
              }, value === undefined ? [key] : [])
              )
            ) : context?.operator === Operators.set ? undefined : false,
        trace: []
      }
    }
  },

  sort: {
    name: "sort",
    func: (context, row, ...args) => {
      const orders = getArgs(Operators.sort, args, row, ext.mergedWith(context ?? {}, { operator: Operators.set }), 1)?.[0];
      (!util.isObject(orders.value) || !Object.keys(orders.value).length > 0) && raise(`$sort failed: invalid sort orders ${util.toString(orders.value)}`);

      return {
        trace: [],
        value: util.multiSort(context?.rows ?? [], orders.value),
        [GLOBAL]: true
      }
    }
  },

  skip: {
    name: "skip",
    func: (context, _row, ...args) => {
      const count = args?.[0];
      !Number.isInteger(count) && raise(`$skip failed: count must be an integer: ${util.toString(count)}`);

      return {
        trace: [],
        value: context?.rows.slice(count) ?? [],
        [GLOBAL]: true
      }
    }
  },

  limit: {
    name: "limit",
    func: (context, _row, ...args) => {
      const count = args?.[0];
      !Number.isInteger(count) && raise(`$limit failed: count must be an integer: ${util.toString(count)}`);

      return {
        trace: [],
        value: context?.rows.slice(0, count) ?? [],
        [GLOBAL]: true
      }
    }
  },

  count: {
    name: "count",
    expandField: false,
    func: (context, _row, ...args) => {
      typeof args?.[0] !== "string" && raise(`$count: field name must be a string: ${util.toString(args?.[0])}`);

      return {
        value: [{ [args[0]]: context?.rows?.length ?? 0 }],
        trace: [],
        [GLOBAL]: true
      };
    }
  },

  group: {
    name: "group",
    expandField: false,
    func: (context, _row, ...args) => {
      !util.isObject(args?.[0]) && raise(`$group: argument is not an object (${util.toString(args?.[0])})`);

      const spec = args[0];
      const rows = context?.rows ?? [];

      const groups = new Map();

      for (const row of rows) {
        const isComputed = util.isObject(spec._id) && Object.keys(spec._id).every(k => !isVar(k));
        const idExpr = isComputed ? { $set: spec._id } : spec._id;
        const id = evaluate(idExpr, row, isComputed ? { ...(context ?? {}), inline: false, operator: Operators.set } : context)?.value ?? null;
        const key = JSON.stringify(id);

        if (!groups.has(key)) {
          groups.set(key, { id, rows: [] });
        }

        groups.get(key).rows.push(row);
      }

      const stdDev = (values, sample) => {
        const n = values.length;
        if (n < (sample ? 2 : 1)) return null;
        const mean = values.reduce((s, x) => s + x, 0) / n;
        const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (sample ? n - 1 : n);
        return Math.sqrt(variance);
      };

      const accumulators = {
        push: (values) => values,
        first: (values) => values[0],
        last: (values) => values[values.length - 1],
        // Dedupes by JSON.stringify key rather than deep-equality (fast-deep-equal
        // would need an O(n²) pairwise scan) — chosen for O(n) performance, matching
        // the same key-order-sensitive tradeoff already used for $group's own _id key.
        addToSet: (values) => [...new Map(values.map(v => [JSON.stringify(v), v])).values()],
        count: (_, groupRows) => groupRows.length,
        stdDevPop: (values) => stdDev(values, false),
        stdDevSamp: (values) => stdDev(values, true),
      };

      const result = [];
      for (const { id, rows: groupRows } of groups.values()) {
        const doc = { _id: id };

        for (const [field, accumSpec] of Object.entries(spec)) {
          if (field === "_id") {
            continue;
          }

          const [[accOp, expr]] = Object.entries(accumSpec);
          const name = accOp.substring(1);

          if (name === "func" && typeof expr === "function") {
            doc[field] = expr(context, groupRows)?.value;
          } else {
            const values = groupRows.map(row => evaluate(expr, row, context)?.value);
            if (accumulators[name]) {
              doc[field] = accumulators[name](values, groupRows);
            } else {
              const op = getOperator(name);
              !op && raise(`$group: unknown accumulator ${accOp}`);
              doc[field] = op.func(context, {}, values)?.value;
            }
          }
        }

        result.push(doc);
      }

      return { value: result, trace: [], [GLOBAL]: true };
    }
  },

  sortByCount: {
    name: "sortByCount",
    expandField: false,
    rawArg: true,
    func: (context, _row, ...args) => {
      const expr = args?.[0];
      const rows = context?.rows ?? [];

      const groups = new Map();
      for (const row of rows) {
        const key = JSON.stringify(evaluate(expr, row, context)?.value ?? null);
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }

      const result = [...groups.entries()]
        .map(([key, count]) => ({ _id: JSON.parse(key), count }))
        .sort((a, b) => b.count - a.count);

      return { value: result, trace: [], [GLOBAL]: true };
    }
  },

  sample: {
    name: "sample",
    expandField: false,
    func: (context, _row, ...args) => {
      const size = args?.[0]?.size ?? args?.[0];
      (!Number.isInteger(size) || size < 0) && raise(`$sample: size must be a non-negative integer: ${util.toString(size)}`);

      const rows = [...(context?.rows ?? [])];
      // Fisher-Yates shuffle up to `size` elements
      for (let i = 0; i < Math.min(size, rows.length); i++) {
        const j = i + Math.floor(Math.random() * (rows.length - i));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }

      return { value: rows.slice(0, size), trace: [], [GLOBAL]: true };
    }
  },

  lookup: {
    name: "lookup",
    expandField: false,
    func: (context, row, ...args) => {
      const spec = args?.[0];

      !util.isObject(spec) && raise(`$lookup: argument must be an object`);
      typeof spec.as !== "string" && raise(`$lookup: as must be a string`);

      const from = Array.isArray(spec.from)
        ? spec.from
        : evaluate(spec.from, row, context)?.value;

      !Array.isArray(from) && raise(`$lookup: from must be or resolve to an array`);

      let matched;

      if (spec.pipeline) {
        const childContext = Object.create(context);
        childContext.vars = Object.create(context?.vars ?? null);

        for (const [name, expr] of Object.entries(spec.let ?? {})) {
          childContext.vars[name] = evaluate(expr, row, context)?.value;
        }

        matched = from.filter(foreignRow =>
          spec.pipeline.every(stage => evaluate(stage, foreignRow, childContext)?.value !== false)
        );
      } else {
        typeof spec.localField !== "string" && raise(`$lookup: localField must be a string`);
        typeof spec.foreignField !== "string" && raise(`$lookup: foreignField must be a string`);

        const localVal = ext.valueForKeypath(row, spec.localField);
        matched = from.filter(foreignRow =>
          deepEqual(ext.valueForKeypath(foreignRow, spec.foreignField), localVal)
        );
      }

      return {
        value: { ...row, [spec.as]: matched },
        trace: []
      };
    }
  },

};
