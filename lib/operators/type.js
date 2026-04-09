// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "../utils.js";
import { raise } from "../utils.js";
import { getArgs, coerceDate } from "../engine.js";
import { Operators } from "./registry.js";

export const operatorsType = {

  type: {
    name: "type",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.type, args, row, context)?.[0];
      const v = result1.value;

      let value;
      if (v === null) {
        value = "null";
      } else if (Array.isArray(v)) {
        value = "array";
      } else if (v instanceof Date) {
        value = "date";
      } else {
        value = typeof v;
      }

      return { value, trace: result1.trace ?? [] };
    }
  },

  isArray: {
    name: "isArray",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.isArray, args, row, context)?.[0];

      return { value: Array.isArray(result1.value), trace: result1.trace ?? [] };
    }
  },

  isNumber: {
    name: "isNumber",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.isNumber, args, row, context)?.[0];

      return { value: typeof result1.value === "number", trace: result1.trace ?? [] };
    }
  },

  isString: {
    name: "isString",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.isString, args, row, context)?.[0];

      return { value: typeof result1.value === "string", trace: result1.trace ?? [] };
    }
  },

  isObject: {
    name: "isObject",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.isObject, args, row, context)?.[0];

      return { value: util.isObject(result1.value), trace: result1.trace ?? [] };
    }
  },

  isDate: {
    name: "isDate",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.isDate, args, row, context)?.[0];

      return { value: result1.value instanceof Date, trace: result1.trace ?? [] };
    }
  },

  toInt: {
    name: "toInt",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.toInt, args, row, context)?.[0];

      const n = parseInt(result1.value);

      Number.isNaN(n) && raise(`$toInt: cannot convert to integer: ${util.toString(result1.value)}`);

      return { value: n, trace: result1.trace ?? [] };
    }
  },

  toDouble: {
    name: "toDouble",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.toDouble, args, row, context)?.[0];

      const n = parseFloat(result1.value);

      Number.isNaN(n) && raise(`$toDouble: cannot convert to double: ${util.toString(result1.value)}`);

      return { value: n, trace: result1.trace ?? [] };
    }
  },

  toBool: {
    name: "toBool",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.toBool, args, row, context)?.[0];
      const v = result1.value;

      let value;
      if (typeof v === "boolean") {
        value = v;
      } else if (typeof v === "number") {
        value = v !== 0;
      } else if (typeof v === "string") {
        value = v.toLowerCase() === "true" || v === "1";
      } else {
        value = v != null;
      }

      return { value, trace: result1.trace ?? [] };
    }
  },

  toDate: {
    name: "toDate",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.toDate, args, row, context)?.[0];
      return { value: coerceDate(result1.value, "$toDate"), trace: result1.trace ?? [] };
    }
  },

};
