// Copyright (c) 2023-2026 tafkafm
// Licensed under the MIT License. See LICENSE file for details.

import { Operators } from "./registry.js";
import { operatorsCore } from "./core.js";
import { operatorsArray } from "./array.js";
import { operatorsArithmetic } from "./arithmetic.js";
import { operatorsString } from "./string.js";
import { operatorsSet } from "./set.js";
import { operatorsDate } from "./date.js";
import { operatorsPipeline } from "./pipeline.js";
import { operatorsType } from "./type.js";

Object.assign(Operators,
  operatorsCore,
  operatorsArray,
  operatorsArithmetic,
  operatorsString,
  operatorsSet,
  operatorsDate,
  operatorsPipeline,
  operatorsType
);

export { Operators };
export { GLOBAL, Args } from "./registry.js";
