// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import { stringify } from "./utils.js";

/** Numeric log-level constants. Lower numbers are more verbose. */
export const LogLevels = {
  INSANE: 0,
  SILLY: 1,
  DEBUG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5
};

/**
 * Tagged proxy for passing a log level into `Logger.log` without a dedicated
 * parameter slot. Access any `LogLevels` key to get a tagged `{ _logLevel }` object
 * that is detected and stripped from the message array at call time.
 * @example logger.log("tag", "msg", LogLevel.DEBUG)
 */
export const LogLevel = new Proxy(LogLevels, {
  get: function(target, methodName) {
    return {_logLevel: LogLevels[methodName] ?? LogLevels.INFO };
  }
});

const LogColors = {
  GREEN: {
    css: "#02b808",
    ansi: "40"
  },
  RED: {
    css: "#b80202",
    ansi: "124"
  }
};

/**
 * Tagged proxy for passing a colour override into `Logger.log`.
 * Access any `LogColors` key to get a tagged `{ _logColor }` object.
 * @example logger.log("tag", "msg", LogColor.RED)
 */
export const LogColor = new Proxy(LogColors, {
  get: function(target, methodName) {
    return {_logColor: LogColors[methodName]};
  }
});

const _ForceLog = {
  true: true,
  false: false
};

/**
 * Tagged proxy for forcing a log message through regardless of the current
 * log level. Pass `ForceLog[true]` or `ForceLog[false]` as a trailing argument
 * to `Logger.log`.
 * @example logger.log("tag", "msg", ForceLog[!!ctx.forceLog])
 */
export const ForceLog = new Proxy(_ForceLog, {
  get: function(target, methodName) {
    return {_forceLog: _ForceLog[methodName]};
  }
});

const LogConfig = {
  [LogLevels.INSANE]: {
    name: "insane",
    color: {
      css: "#cf06c8",
      ansi: "13"
    }
  },
  [LogLevels.SILLY]: {
    name: "silly",
    color: {
      css: "#9626f1",
      ansi: "93"
    }
  },
  [LogLevels.DEBUG]: {
    name: "debug",
    color: {
      css: "#1fbfff",
      ansi: "65"
    }
  },
  [LogLevels.INFO]: {
    name: "info",
    color: {
      css: "#dbbf07",
      ansi: "12"
    }
  },
  [LogLevels.WARN]: {
    name: "warn",
    color: {
      css: "#cf6e06",
      ansi: "11"
    }
  },
  [LogLevels.ERROR]: {
    name: "error",
    color: {
      css: "#fc5353",
      ansi: "9"
    }
  }
};

/**
 * Detects the appropriate colour mode for the current runtime:
 * - React Native (Hermes/JSC) → `"ansi"` (Metro terminal)
 * - Browser → `"css"` (DevTools `%c` syntax)
 * - Node.js → `"ansi"`
 * @returns {"ansi"|"css"}
 */
const detectColorMode = () => {
  if (typeof global !== "undefined" && global.nativePerformanceNow != null) {
    return "ansi"; // React Native (Hermes/JSC) — Metro terminal supports ANSI
  }
  if (typeof window !== "undefined") {
    return "css";  // browser DevTools
  }
  return "ansi";   // Node.js
};

/**
 * Minimal structured logger with ANSI (Node / React Native) and CSS
 * (browser DevTools) colour output.
 *
 * Messages below `logLevel` are suppressed unless a `ForceLog[true]` tag is
 * present. Up to three tagged proxy values (`LogLevel`, `LogColor`, `ForceLog`)
 * may appear at the tail of the argument list and are stripped before printing.
 *
 * @example
 * const log = new Logger({ logLevel: LogLevels.DEBUG });
 * log.log("my:tag", "hello", LogLevel.INFO, LogColor.GREEN);
 */
class Logger {
  maxLogMessageLength = -1;
  logLevel = LogLevels.INFO
  defaultLevel = LogLevels.INFO;
  useColors = "ansi";
  location = null;

  /**
   * @param {object} [options]
   * @param {number} [options.logLevel] - Minimum level to emit (default: INFO).
   * @param {number} [options.defaultLevel] - Level assumed when none is tagged (default: INFO).
   * @param {string|null} [options.location] - Prefix prepended to every location string.
   * @param {"ansi"|"css"} [options.useColors] - Colour mode (auto-detected when omitted).
   */
  constructor(options) {
    ["logLevel", "defaultLevel", "location"].forEach(key => this[key] = options?.[key] ?? this[key]);
    this.useColors = options?.useColors ?? detectColorMode();
  }
  
  /**
   * Emits a log line. Tagged proxy values (`LogLevel`, `LogColor`, `ForceLog`)
   * are detected in the last up-to-3 arguments, stripped from the message, and
   * used to set the level, colour, and force-log flag for this call.
   * @param {string} location - Colon-separated path shown in the breadcrumb (e.g. `"evaluate:result"`).
   * @param {...unknown} message - Values to print; objects are JSON-stringified.
   * @returns {string} The formatted line with escape codes stripped (useful for testing).
   */
  log = (location, ...message) => {
  
    let level = null, color = null, forceLog = false;

    if (!message.length) {
      level = LogLevels.ERROR;
      message = ["no message passed to log."]
    } else {
      // at most 3 tagged proxy args (LogLevel, LogColor, ForceLog) can appear at the tail
      message.push(...message.splice(Math.max(message.length - 3, 0)).filter(item => {
        level ??= item?._logLevel;
        color ??= item?._logColor?.[this.useColors];
        forceLog ||= !!item?._forceLog;

        return !(level || color || item?._forceLog != null);
      }));
    }

    level ??= this.defaultLevel;
  
    if (level < this.logLevel && !forceLog) {
      return;
    }

    color ??= LogConfig[level].color[this.useColors];

    let time = new Date().toISOString();
    let levelName = LogConfig[level].name;
    if (levelName.length < 5) {
      time = time + ''.padStart(5 - levelName.length);
    }
    
    let result = [];
    if (this.useColors === "css") {
      result = [`%c${time} %c[%c${levelName}%c] `, "color:gray", "color:white", `color:${color}`, "color:white"];
    } else {
      result = [`\u001b[38;5;232m${time} \u001b[38;5;15m[\u001b[38;5;${color}m${levelName}\u001b[38;5;15m] `];
    }
  
    const locations = location.split(":");
  
    if (this.location) {
      locations.unshift(this.location);
    }
  
    locations.forEach((l, index) => {
      let grayTone = 127 + (127 / Math.max(1, locations.length - 1) * index) | 0;

      if (this.useColors === "css") {
        result[0] += `%c${l}:`;
        result.push(`color:rgb(${grayTone}, ${grayTone}, ${grayTone})`);
      } else if (this.useColors === "ansi") {
        result[0] += `\u001b[38;2;${grayTone};${grayTone};${grayTone}m${l}:\u001b[0m`;
      }
    });

    if (this.useColors === "css") {
      result[0] += ` %c`;
      result.push(`color:${color}`);
    } else if (this.useColors === "ansi") {
      result[0] += ` \u001b[38;5;${color}m`
    }
    
    result[0] += message
                  .map((item) => item && typeof item === "object" && !(typeof Event !== "undefined" && item instanceof Event) ? stringify(item) : item)
                  .join(', ')
                  .substring(0, this.maxLogMessageLength !== -1 ? this.maxLogMessageLength : Number.MAX_SAFE_INTEGER);
  
    console.log(...result);

    // eslint-disable-next-line no-control-regex
    return this.useColors === "css" ? result[0]?.replaceAll(/%c/g, "") : result[0]?.replaceAll(/\u001b.+m?/g, "");
  }  
}

export { Logger };
