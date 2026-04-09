// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "../utils.js";
import { raise } from "../utils.js";
import { getArgs } from "../engine.js";
import { Operators } from "./registry.js";

export const operatorsString = {

  strConcat: {
    name: "strConcat",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.strConcat, args, row, context)?.[0];
      !Array.isArray(result1?.value) && raise(`$strConcat failed: argument must be an array: ${util.toString(result1?.value)}`);
      result1.value.forEach((v, i) => typeof v !== "string" && raise(`$strConcat failed: element ${i} must be a string: ${util.toString(v)}`));
      return { value: result1.value.join(""), trace: result1.trace ?? [] };
    }
  },

  toLower: {
    name: "toLower",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.toLower, args, row, context)?.[0];
      typeof result1.value !== "string" && raise(`$toLower failed: arg must be a string: ${util.toString(result1.value)}`);
      return { value: result1.value.toLowerCase(), trace: result1.trace ?? [] };
    }
  },

  toUpper: {
    name: "toUpper",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.toUpper, args, row, context)?.[0];
      typeof result1.value !== "string" && raise(`$toUpper failed: arg must be a string: ${util.toString(result1.value)}`);
      return { value: result1.value.toUpperCase(), trace: result1.trace ?? [] };
    }
  },

  toString: {
    name: "toString",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.toString, args, row, context)?.[0];
      return { value: result1.value == null ? null : String(result1.value), trace: result1.trace ?? [] };
    }
  },

  strLen: {
    name: "strLen",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.strLen, args, row, context)?.[0];
      typeof result1.value !== "string" && raise(`$strLen failed: arg must be a string: ${util.toString(result1.value)}`);
      return { value: result1.value.length, trace: result1.trace ?? [] };
    }
  },

  substr: {
    name: "substr",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.substr, args, row, context);
      const str = results?.[0];
      const start = results?.[1];
      const length = results?.[2];
      typeof str.value !== "string" && raise(`$substr failed: first arg must be a string: ${util.toString(str.value)}`);
      !Number.isInteger(start.value) && raise(`$substr failed: start must be an integer: ${util.toString(start.value)}`);
      length?.value != null && !Number.isInteger(length.value) && raise(`$substr failed: length must be an integer: ${util.toString(length.value)}`);
      return {
        value: length?.value != null && length.value !== -1 ? str.value.substr(start.value, length.value) : str.value.substring(start.value),
        trace: str.trace ?? []
      };
    }
  },

  split: {
    name: "split",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.split, args, row, context);
      const str = results?.[0];
      const delimiter = results?.[1];
      typeof str.value !== "string" && raise(`$split failed: first arg must be a string: ${util.toString(str.value)}`);
      typeof delimiter.value !== "string" && raise(`$split failed: delimiter must be a string: ${util.toString(delimiter.value)}`);
      return { value: str.value.split(delimiter.value), trace: str.trace?.concat(delimiter.trace ?? []) ?? [] };
    }
  },

  trim: {
    name: "trim",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.trim, args, row, context);
      const str = results?.[0];
      const chars = results?.[1]?.value;
      typeof str.value !== "string" && raise(`$trim failed: arg must be a string: ${util.toString(str.value)}`);
      if (chars != null) {
        typeof chars !== "string" && raise(`$trim failed: chars must be a string: ${util.toString(chars)}`);
        const escaped = chars.replace(/[-[\]^\\]/g, "\\$&");
        return { value: str.value.replace(new RegExp(`^[${escaped}]+|[${escaped}]+$`, "g"), ""), trace: str.trace ?? [] };
      }
      return { value: str.value.trim(), trace: str.trace ?? [] };
    }
  },

  ltrim: {
    name: "ltrim",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.ltrim, args, row, context);
      const str = results?.[0];
      const chars = results?.[1]?.value;

      typeof str.value !== "string" && raise(`$ltrim failed: arg must be a string: ${util.toString(str.value)}`);

      if (chars != null) {
        typeof chars !== "string" && raise(`$ltrim failed: chars must be a string: ${util.toString(chars)}`);

        const escaped = chars.replace(/[-[\]^\\]/g, "\\$&");

        return { value: str.value.replace(new RegExp(`^[${escaped}]+`, "g"), ""), trace: str.trace ?? [] };
      }
      return { value: str.value.trimStart(), trace: str.trace ?? [] };
    }
  },

  rtrim: {
    name: "rtrim",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const results = getArgs(Operators.rtrim, args, row, context);
      const str = results?.[0];
      const chars = results?.[1]?.value;

      typeof str.value !== "string" && raise(`$rtrim failed: arg must be a string: ${util.toString(str.value)}`);

      if (chars != null) {
        typeof chars !== "string" && raise(`$rtrim failed: chars must be a string: ${util.toString(chars)}`);

        const escaped = chars.replace(/[-[\]^\\]/g, "\\$&");

        return { value: str.value.replace(new RegExp(`[${escaped}]+$`, "g"), ""), trace: str.trace ?? [] };
      }

      return { value: str.value.trimEnd(), trace: str.trace ?? [] };
    }
  },

  indexOf: {
    name: "indexOf",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.indexOf, args, row, context);
      const str = results?.[0];
      const substring = results?.[1];

      typeof str.value !== "string" && raise(`$indexOf failed: first arg must be a string: ${util.toString(str.value)}`);
      typeof substring.value !== "string" && raise(`$indexOf failed: second arg must be a string: ${util.toString(substring.value)}`);

      return { value: str.value.indexOf(substring.value), trace: str.trace?.concat(substring.trace ?? []) ?? [] };
    }
  },

  regexMatch: {
    name: "regexMatch",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.regexMatch, args, row, context);
      const str = results?.[0]?.value;
      const pattern = results?.[1]?.value;
      const options = results?.[2]?.value ?? "";

      typeof str !== "string" && raise(`$regexMatch: input must be a string: ${util.toString(str)}`);
      typeof pattern !== "string" && raise(`$regexMatch: regex must be a string: ${util.toString(pattern)}`);

      return { value: new RegExp(pattern, options).test(str), trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [] };
    }
  },

  regexFind: {
    name: "regexFind",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.regexFind, args, row, context);
      const str = results?.[0]?.value;
      const pattern = results?.[1]?.value;
      const options = results?.[2]?.value ?? "";

      typeof str !== "string" && raise(`$regexFind: input must be a string: ${util.toString(str)}`);
      typeof pattern !== "string" && raise(`$regexFind: regex must be a string: ${util.toString(pattern)}`);

      const match = str.match(new RegExp(pattern, options));
      const value = match
        ? { match: match[0], idx: match.index, captures: match.slice(1) }
        : null;

      return { value, trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [] };
    }
  },

  regexFindAll: {
    name: "regexFindAll",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.regexFindAll, args, row, context);
      const str = results?.[0]?.value;
      const pattern = results?.[1]?.value;
      const options = results?.[2]?.value ?? "";

      typeof str !== "string" && raise(`$regexFindAll: input must be a string: ${util.toString(str)}`);
      typeof pattern !== "string" && raise(`$regexFindAll: regex must be a string: ${util.toString(pattern)}`);

      const value = [];
      for (const match of str.matchAll(new RegExp(pattern, `g${options.replace("g", "")}`))) {
        value.push({ match: match[0], idx: match.index, captures: match.slice(1) });
      }

      return { value, trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [] };
    }
  },

  replaceOne: {
    name: "replaceOne",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.replaceOne, args, row, context);
      const str = results?.[0]?.value;
      const find = results?.[1]?.value;
      const replacement = results?.[2]?.value;

      typeof str !== "string" && raise(`$replaceOne: input must be a string: ${util.toString(str)}`);
      typeof find !== "string" && raise(`$replaceOne: find must be a string: ${util.toString(find)}`);
      typeof replacement !== "string" && raise(`$replaceOne: replacement must be a string: ${util.toString(replacement)}`);

      return { value: str.replace(find, replacement), trace: results[0]?.trace ?? [] };
    }
  },

  replaceAll: {
    name: "replaceAll",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.replaceAll, args, row, context);
      const str = results?.[0]?.value;
      const find = results?.[1]?.value;
      const replacement = results?.[2]?.value;

      typeof str !== "string" && raise(`$replaceAll: input must be a string: ${util.toString(str)}`);
      typeof find !== "string" && raise(`$replaceAll: find must be a string: ${util.toString(find)}`);
      typeof replacement !== "string" && raise(`$replaceAll: replacement must be a string: ${util.toString(replacement)}`);

      return { value: str.replaceAll(find, replacement), trace: results[0]?.trace ?? [] };
    }
  },

};
