// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import * as util from "../utils.js";
import { raise } from "../utils.js";
import { getArgs, evaluate, coerceDate } from "../engine.js";
import { Operators } from "./registry.js";

export const operatorsDate = {

  date: {
    name: "date",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.date, args, row, context)?.[0];
      const traceResult = result1.trace ?? [];

      const delta = parseInt(result1?.value);

      Number.isNaN(delta) && raise(`$date failed. delta argument not a number: ${util.toString(result1?.value)}`);

      return {
        value: new Date(Date.now() + delta),
        trace: traceResult
      };
    }
  },

  dateToString: {
    name: "dateToString",
    func: (context, row, ...args) => {
      const results = getArgs(Operators.dateToString, args, row, context);
      let date = results[0]?.value;
      let timeZoneOffset = results[2]?.value ?? 0;

      if (typeof date === "string") {
        try {
          const offset = date.match(/([+-])(\d{2})(\d{2})/);
          if (offset) {
            timeZoneOffset = `${offset?.[1]}1` * (Number(offset?.[2]) * 60 * 60 + Number(offset[3]) * 60) * 1000;
          }

          date = new Date(util.normalizeDateString(date));
        } catch (error) {
          raise(`$dateToString: failed converting ${util.toString(date)} to a Date object: ${error.message}`);
        }
      }

      isNaN(date.getTime()) && raise(`$dateToString: ${args?.[0]?.[0]}(${util.toString(date)}) is not a valid date`);

      date = new Date(date.getTime() + timeZoneOffset);

      return {
        trace: results[0]?.trace?.concat(results[1]?.trace ?? []) ?? [],
        value: util.formatDate(date, results[1].value)
      }
    }
  },

  dateFromString: {
    name: "dateFromString",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.dateFromString, args, row, context)?.[0];

      typeof result1.value !== "string" && raise(`$dateFromString: input must be a string: ${util.toString(result1.value)}`);

      return { value: coerceDate(result1.value, "$dateFromString"), trace: result1.trace ?? [] };
    }
  },

  dateAdd: {
    name: "dateAdd",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const spec = args?.[0];
      !util.isObject(spec) && raise(`$dateAdd: argument must be an object`);

      const startDate = coerceDate(evaluate(spec.startDate, row, context)?.value, "$dateAdd");
      const amount = evaluate(spec.amount, row, context)?.value;
      const unit = evaluate(spec.unit, row, context)?.value;

      !Number.isInteger(amount) && raise(`$dateAdd: amount must be an integer: ${util.toString(amount)}`);
      typeof unit !== "string" && raise(`$dateAdd: unit must be a string: ${util.toString(unit)}`);

      const ms = {
        millisecond: 1,
        second: 1000,
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        week: 604_800_000
      }[unit];

      !ms && raise(`$dateAdd: unsupported unit: ${util.toString(unit)}`);

      return { value: new Date(startDate.getTime() + amount * ms), trace: [] };
    }
  },

  dateSubtract: {
    name: "dateSubtract",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const spec = args?.[0];
      !util.isObject(spec) && raise(`$dateSubtract: argument must be an object`);

      const startDate = coerceDate(evaluate(spec.startDate, row, context)?.value, "$dateSubtract");
      const amount = evaluate(spec.amount, row, context)?.value;
      const unit = evaluate(spec.unit, row, context)?.value;

      !Number.isInteger(amount) && raise(`$dateSubtract: amount must be an integer: ${util.toString(amount)}`);
      typeof unit !== "string" && raise(`$dateSubtract: unit must be a string: ${util.toString(unit)}`);

      const ms = {
        millisecond: 1,
        second: 1000,
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        week: 604_800_000
      }[unit];

      !ms && raise(`$dateSubtract: unsupported unit: ${util.toString(unit)}`);

      return { value: new Date(startDate.getTime() - amount * ms), trace: [] };
    }
  },

  dateDiff: {
    name: "dateDiff",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const spec = args?.[0];
      !util.isObject(spec) && raise(`$dateDiff: argument must be an object`);

      const startDate = coerceDate(evaluate(spec.startDate, row, context)?.value, "$dateDiff");
      const endDate = coerceDate(evaluate(spec.endDate, row, context)?.value, "$dateDiff");
      const unit = evaluate(spec.unit, row, context)?.value;

      typeof unit !== "string" && raise(`$dateDiff: unit must be a string: ${util.toString(unit)}`);

      const ms = {
        millisecond: 1,
        second: 1000,
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        week: 604_800_000
      }[unit];

      !ms && raise(`$dateDiff: unsupported unit: ${util.toString(unit)}`);

      return { value: Math.trunc((endDate.getTime() - startDate.getTime()) / ms), trace: [] };
    }
  },

  year: {
    name: "year",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.year, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$year");

      return { value: d.getUTCFullYear(), trace: result1.trace ?? [] };
    }
  },

  month: {
    name: "month",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.month, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$month");

      return { value: d.getUTCMonth() + 1, trace: result1.trace ?? [] };
    }
  },

  dayOfMonth: {
    name: "dayOfMonth",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.dayOfMonth, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$dayOfMonth");

      return { value: d.getUTCDate(), trace: result1.trace ?? [] };
    }
  },

  dayOfWeek: {
    name: "dayOfWeek",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.dayOfWeek, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$dayOfWeek");

      return { value: d.getUTCDay() + 1, trace: result1.trace ?? [] };
    }
  },

  dayOfYear: {
    name: "dayOfYear",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.dayOfYear, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$dayOfYear");

      return { value: util.getDayOfYear(d), trace: result1.trace ?? [] };
    }
  },

  hour: {
    name: "hour",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.hour, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$hour");

      return { value: d.getUTCHours(), trace: result1.trace ?? [] };
    }
  },

  minute: {
    name: "minute",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.minute, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$minute");

      return { value: d.getUTCMinutes(), trace: result1.trace ?? [] };
    }
  },

  second: {
    name: "second",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.second, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$second");

      return { value: d.getUTCSeconds(), trace: result1.trace ?? [] };
    }
  },

  millisecond: {
    name: "millisecond",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.millisecond, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$millisecond");

      return { value: d.getUTCMilliseconds(), trace: result1.trace ?? [] };
    }
  },

  isoDayOfWeek: {
    name: "isoDayOfWeek",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.isoDayOfWeek, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$isoDayOfWeek");

      return { value: util.getISODay(d), trace: result1.trace ?? [] };
    }
  },

  isoWeek: {
    name: "isoWeek",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.isoWeek, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$isoWeek");

      return { value: util.getISOWeekNumber(d), trace: result1.trace ?? [] };
    }
  },

  isoWeekYear: {
    name: "isoWeekYear",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.isoWeekYear, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$isoWeekYear");

      return { value: util.getISOWeekYear(d), trace: result1.trace ?? [] };
    }
  },

  week: {
    name: "week",
    minArgCount: 1,
    func: (context, row, ...args) => {
      const result1 = getArgs(Operators.week, args, row, context)?.[0];

      const d = coerceDate(result1.value, "$week");

      return { value: util.getWeekNumber(d), trace: result1.trace ?? [] };
    }
  },

};
