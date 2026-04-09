// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import { valueForKeypath } from "./extensions.js";

/**
 * Returns `true` if `obj` is a plain object (not an array, not a Date).
 * @param {unknown} obj
 * @param {boolean} [nonNull=true] - When true, `null` returns false.
 * @returns {boolean}
 */
export const isObject = (obj, nonNull = true) => {
  const type = typeof obj;
  return (!nonNull || (obj != null)) && (type === 'object') && !Array.isArray(obj) && !["Date"].includes(obj?.constructor?.name);
}

/**
 * Returns `true` if `obj` is a plain object or array (i.e., not a primitive).
 * @param {unknown} obj
 * @returns {boolean}
 */
export const isNonPrimitive = (obj) => {
  return isObject(obj) || Array.isArray(obj);
}

/**
 * Returns a type string for `value`, extended beyond `typeof` to distinguish
 * `"array"` and `"date"` from plain objects.
 * Returns `null` or `undefined` as-is when `value` is nullish.
 * @param {unknown} value
 * @returns {string|null|undefined}
 */
export const typeOf = (value) => {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (value.constructor.name === "Date") {
    return "date";
  }

  return typeof value;
}

/**
 * Converts `value` to a human-readable string. Objects and arrays are
 * JSON-stringified with single quotes replacing double quotes; primitives
 * are returned as-is.
 * @param {unknown} value
 * @returns {string}
 */
export const toString = (value) => {
  return isNonPrimitive(value) ? JSON.stringify(value).replaceAll(/"/g, "'") : value;
}

/**
 * Throws an `Error` with `message`. Used as a one-liner throw expression.
 * @param {string} message
 * @returns {never}
 */
export const raise = (message) => { throw new Error(message) };

/**
 * `new Date(str)` parses a bare ISO 8601 date-time string (no `Z`/offset) as
 * local time per spec, making parsing depend on the host's system timezone.
 * Appends `Z` to force UTC interpretation, matching this library's UTC-only
 * convention elsewhere. Date-only strings and strings with an explicit
 * offset/`Z` are left untouched (already unambiguous); non-string values
 * pass through unchanged.
 * @param {*} value
 * @returns {*}
 */
export const normalizeDateString = (value) => {
  if (typeof value !== "string") { return value; }
  const hasTime = /T\d{2}:\d{2}/.test(value);
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  return (hasTime && !hasOffset) ? `${value}Z` : value;
};

/**
 * JSON-stringifies `value`, replacing circular references with the string
 * `"<circular>"` instead of throwing.
 * @param {unknown} value
 * @returns {string}
 */
export const stringify = (value) => {
  const cache = new WeakMap();
  return JSON.stringify(value, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) {
        return "<circular>";
      }
      cache.set(value);
    }
    return value;
  });
};

/**
 * Sorts `array` in-place using multiple key criteria. `sortCriteria` is an
 * object mapping dot-path field names to `1` (ascending) or `-1` (descending).
 * Keys are applied left-to-right as tiebreakers.
 * @param {object[]} array
 * @param {Record<string, 1|-1>} sortCriteria
 * @returns {object[]}
 */
export const multiSort = (array, sortCriteria) => {
  return array.sort((a, b) => {
    for (const [key, direction = 1] of Object.entries(sortCriteria)) {
      const first = valueForKeypath(a, key)?.valueOf();
      const second = valueForKeypath(b, key)?.valueOf();
      if (first < second) {
        return -1 * direction;
      }

      if (first > second) {
        return 1 * direction;
      }
    }
    return 0;
  });
}

/**
 * Returns the 1-based day-of-year for `date` (UTC).
 * @param {Date} date
 * @returns {number}
 */
export const getDayOfYear = (date) => {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;

  return Math.floor(diff / oneDay);
}

/**
 * Returns the ISO 8601 week-numbering year for `date` (UTC).
 * This can differ from the calendar year around year boundaries.
 * @param {Date} date
 * @returns {number}
 */
export const getISOWeekYear = (date) => {
  const target = new Date(date.valueOf());
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));

  return target.getUTCFullYear();
}

/**
 * Returns the ISO 8601 week number (1–53) for `date` (UTC).
 * Week 1 is the week containing the first Thursday of the year.
 * @param {Date} date
 * @returns {number}
 */
export const getISOWeekNumber = (date) => {
  const startOfISOYear = new Date(Date.UTC(getISOWeekYear(date), 0, 4));
  const dayOfYear = getDayOfYear(date) - getDayOfYear(startOfISOYear) + 1;

  return Math.ceil(dayOfYear / 7);
}

/**
 * Returns the Sunday-based week number (1–53) for `date` (UTC).
 * Week 1 begins on the first Sunday of the year.
 * @param {Date} date
 * @returns {number}
 */
export const getWeekNumber = (date) => {
  const firstSunday = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  firstSunday.setUTCDate(firstSunday.getUTCDate() + (7 - firstSunday.getUTCDay()) % 7);
  const diff = date - firstSunday;
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  
  return Math.floor(diff / oneWeek) + 1;
}

/**
 * Returns the ISO 8601 day of the week (1 = Monday … 7 = Sunday) for `date` (UTC).
 * @param {Date} date
 * @returns {number}
 */
export const getISODay = (date) => {
  const day = date.getUTCDay();

  return day === 0 ? 7 : day;
}

/**
 * Deep-equality check that handles primitives, Dates, boxed types, and plain
 * objects. Uses `valueOf()` as a fast path for Date and boxed-primitive
 * comparison before falling back to `JSON.stringify`.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export const isEqualValue = (a, b) => {
  if (a === b) { 
    return true; 
  }
  
  if (typeof a !== typeof b || typeof a !== "object" || a === null) { 
    return false; 
  }
  
  const va = a.valueOf(), vb = b.valueOf();
  if (va !== a || vb !== b) { 
    return va === vb; 
  }
  
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Returns the UTC offset of `date` as a `+HHmm` / `-HHmm` string
 * (e.g. `"+0200"`, `"-0530"`).
 * @param {Date} date
 * @returns {string}
 */
export const getTimezoneOffsetString = (date) => {
  const offset = -date.getTimezoneOffset(); // In minutes
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, "0")
  const minutes = String(absOffset % 60).padStart(2, "0");

  return `${sign}${hours}${minutes}`;
}

const getTimezoneName = (date) => {
  const options = { timeZoneName: 'short' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  const timeZoneName = parts.find(part => part.type === 'timeZoneName');

  return timeZoneName ? timeZoneName.value : '';
}

/**
 * Formats `date` using a strftime-style `format` string.
 * Supported specifiers: `%Y %y %m %d %H %M %S %G %j %L %u %U %v %w %z %Z`.
 * Unrecognised specifiers are left as-is.
 * @param {Date} date
 * @param {string} format
 * @returns {string}
 */
export const formatDate = (date, format) => {
  const replacements = {
    Y: () => date.getUTCFullYear(),
    y: () => date.getUTCFullYear() % (~~Math.floor(date.getUTCFullYear() / 100) * 100),
    m: () => String(date.getUTCMonth() + 1).padStart(2, '0'),
    d: () => String(date.getUTCDate()).padStart(2, '0'),
    H: () => String(date.getUTCHours()).padStart(2, '0'),
    M: () => String(date.getUTCMinutes()).padStart(2, '0'),
    S: () => String(date.getUTCSeconds()).padStart(2, '0'),
    G: () => getISOWeekYear(date),
    j: () => String(getDayOfYear(date)).padStart(3),
    L: () => String(date.getUTCMilliseconds()).padStart(3),
    u: () => getISODay(date),
    U: () => getWeekNumber(date),
    v: () => getISOWeekNumber(date),
    w: () => date.getUTCDay(),
    z: () => getTimezoneOffsetString(date),
    Z: () => getTimezoneName(date)
  };

  return format.replace(/%([YyMmdHSGjLuUvwzZ])/g, match => replacements[match?.[1]]?.() || match?.[1]);
}