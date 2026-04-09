// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

/**
 * Internal recursive merge. Copies properties from `otherObject` into `object`
 * according to `options`. Skips prototype-pollution keys (`__proto__`,
 * `constructor`, `prototype`).
 * @param {object|Array} object - Target (mutated in-place).
 * @param {object|Array} otherObject - Source.
 * @param {object} [options]
 * @param {boolean} [options.onlyIfNotNull] - Skip source properties that are null/undefined.
 * @param {boolean} [options.onlyIfNotPresent] - Skip if target already has the key.
 * @param {string[]} [options.except] - Keys to skip.
 * @param {{ array?: boolean, object?: boolean }} [options.overwrite] - Replace arrays/objects instead of merging.
 * @param {number} [options.depth] - Maximum recursion depth.
 * @returns {object|Array}
 */
const _merge = (object, otherObject, options = {}) => {
  if (options?.depth !== 0) {
    Object.keys(otherObject ?? {}).forEach(p => {
      if (p === '__proto__' || p === 'constructor' || p === 'prototype') { return; }
      const has1 = Object.prototype.hasOwnProperty.call(object, p);
      const shouldMerge = (!options?.onlyIfNotNull || (otherObject[p] !== undefined && otherObject[p] !== null)) && (!options?.except || !options?.except.includes(p)) && (!options?.onlyIfNotPresent || !has1 || (object[p] && otherObject[p] && (object[p].constructor.name === "Object" && otherObject[p].constructor.name === "Object")));
      if (shouldMerge) {
        try {
          if (Object(otherObject[p]) !== otherObject[p] || otherObject[p].constructor === Function || ((otherObject[p].constructor.name !== "Object" || (options?.keepFrozen !== false && Object.isFrozen(otherObject[p]))) && otherObject[p].constructor.name !== "Array")) {
            object[p] = otherObject[p];
          } else {
            if (otherObject[p].constructor === Object) {
              if (options?.overwrite?.object) {
                object[p] = otherObject[p];
              } else {
                if (!has1) {
                  object[p] = {};
                }
              }
              _merge(object[p], otherObject[p], { ...(options ?? {}), depth: (options?.depth ?? Number.MAX_SAFE_INTEGER) - 1 });
            } else if (otherObject[p].constructor === Array) {
              if (options?.overwrite?.array) {
                object[p] = otherObject[p]
              } else {
                if (!has1) {
                  object[p] = [];
                }
                _merge(object[p], otherObject[p], { ...(options ?? {}), depth: (options?.depth ?? Number.MAX_SAFE_INTEGER) - 1 });
              }
            }
          }
        } catch (e) {
          console.error(`_merge error: `, e);
          object[p] = otherObject[p];
        }
      }
    });
  }

  return object;
};

const _mergeWith = function (object, otherObject, options = { onlyIfNotNull: false, onlyIfNotPresent: false, except: null, overwrite: { array: true, object: false }, depth: Number.MAX_SAFE_INTEGER }) {
  return _merge(object, otherObject, options);
}

/**
 * Deep-merges `otherObject` into `object` in-place and returns `object`.
 * Arrays are replaced by default (`overwrite.array: true`); nested objects
 * are merged recursively.
 * @param {object} object - Target (mutated).
 * @param {object} otherObject - Source.
 * @param {object} [options]
 * @returns {object}
 */
export const mergeWith = (object, otherObject, options = { onlyIfNotNull: false, onlyIfNotPresent: false, except: null, overwrite: { array: true, object: false }, depth: Number.MAX_SAFE_INTEGER }) => {
  return _mergeWith(object, otherObject, options);
}

/**
 * Like `mergeWith` but returns a deep clone of `object` merged with
 * `otherObject`, leaving the original untouched.
 * @param {object} object
 * @param {object} otherObject
 * @param {object} [options]
 * @returns {object}
 */
export const mergedWith = (object, otherObject, options = { onlyIfNotNull: false, onlyIfNotPresent: false, except: null, overwrite: { array: true, object: false }, depth: Number.MAX_SAFE_INTEGER }) => {
  return _mergeWith(klone(object), otherObject, options);
}

/**
 * Replaces all own properties of `object` with those of `otherObject` in-place.
 * Equivalent to clearing `object` and then merging `otherObject` into it.
 * @param {object} object - Target (mutated).
 * @param {object} otherObject - Source.
 * @returns {object}
 */
export const replaceWith = (object, otherObject) => {
  Object.keys(object).forEach(key => delete object[key]);
  return _mergeWith(object, otherObject);
}

/**
 * Returns a deep clone of `arg`. Supports objects and arrays; non-object
 * values (primitives, Dates, functions) are copied by reference.
 * @template T
 * @param {T} arg
 * @param {number} [depth] - Maximum clone depth (default: unlimited).
 * @returns {T}
 */
export const klone = (arg, depth = Number.MAX_SAFE_INTEGER) => {
  return mergeWith((Array.isArray(arg) ? [] : {}), arg, { depth });
}

/**
 * Reads a nested value from `object` using a dot-separated `keyPath`.
 * Array index segments (e.g. `"scores.0"`) are supported. Returns
 * `defaultValue` when any intermediate key is missing.
 * @param {object|Array|null|undefined} object
 * @param {string} keyPath
 * @param {unknown} [defaultValue]
 * @param {string} [separator="."]
 * @returns {unknown}
 */
export const valueForKeypath = (object, keyPath, defaultValue = undefined, separator = ".") => {
  if (!object) {
    return object;
  }

  return keyPath?.split?.(separator)?.reduce((previous, current) => {
    if (!previous || Object.keys(previous).length === 0) {
      return defaultValue;
    }

    return (
      current == +current && Array.isArray(previous)
        ? previous?.[current]
        : Object.prototype.hasOwnProperty.call(previous, current) ? previous?.[current] : defaultValue
    )

  }, object);
}

/**
 * Writes `value` into `object` at the location described by the dot-separated
 * `keyPath`. Creates intermediate objects/arrays as needed. Supports:
 * - `"a.b.c"` — plain nested write
 * - `"tags[]"` — appends `value` to the array at `tags`
 * - `"tags[0]"` — writes to a specific array index
 * Passing `undefined` as `value` deletes the key. Skips prototype-pollution
 * keys (`__proto__`, `constructor`, `prototype`).
 * @param {object} object - Target (mutated).
 * @param {string} keyPath
 * @param {unknown} [value]
 * @param {string} [separator="."]
 * @returns {object}
 */
export const setValueForKeypath = (object, keyPath, value = null, separator = ".") => {
  if (!object) {
    return ;
  }

  keyPath.split(separator).reduce(function (previous, current, index, values) {
    if (current === '__proto__' || current === 'constructor' || current === 'prototype') { return previous; }
    const match = current.match(/(.+?)\[(.*?)\]/);
    const isArray = !!match;
    const arrayIndex = match?.[2] && match[2].match?.(/^\d+$/) ? parseInt(match[2]) : -1;
    const hasIndex = arrayIndex >= 0;
    const done = index === values.length - 1;

    current = match?.[1] ?? current;

    if (!Object.prototype.hasOwnProperty.call(previous, current) || !["Object", "Array"].includes(previous[current]?.constructor?.name)) {
      previous[current] = isArray ? [] : {};
      if (isArray && !hasIndex && !done) {
        previous[current].push({});
      }
    }

    if (done) {
      if (isArray) {
        if (!hasIndex) {
          previous[match[1]].push(value);
        } else {
          if (arrayIndex >= previous[current].length) {
            throw new Error(`Array index ${arrayIndex} is out of bounds (${previous[current].length})`);
          }

          previous[current][arrayIndex] = value;
        }
      } else {
        if (typeof value !== "undefined") {
          previous[current] = value;
        } else {
          delete previous[current];
        }
      }

      return object;
    }

    if (isArray) {
      for (let i = previous[current].length; i <= arrayIndex; i++) previous[current].push(null);
      return previous[current][hasIndex ? arrayIndex : 0];
    } else {
      return previous[current];
    }
  }, object);

  return object;
}

/**
 * Returns the element at `array[offset]`, or a slice of `count` elements
 * starting at `offset`. Returns `undefined` if the range is out of bounds.
 * @param {unknown[]} array
 * @param {number} [offset=0]
 * @param {number} [count=1]
 * @param {boolean} [asArray=false] - When true, always returns an array even for count=1.
 * @returns {unknown}
 */
export const first = (array, offset = 0, count = 1, asArray = false) => {
  return array.length >= offset + count ? count === 1 && asArray === false ? array[offset] : array.slice(offset, count >= 0 ? offset + count : undefined) : undefined;
}

/**
 * Returns a copy of `object` with the given `keys` removed.
 * @param {object} object
 * @param {string[]} keys - Keys to omit.
 * @param {boolean} [klone=true] - When false, mutates `object` directly instead of cloning.
 * @returns {object}
 */
export const omit = (object, keys, klone = true) => {
  const copy = klone ? _mergeWith({}, object) : object;
  keys.forEach(key => delete copy[key]);
  return copy;
}
