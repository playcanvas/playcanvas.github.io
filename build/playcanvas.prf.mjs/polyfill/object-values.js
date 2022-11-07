/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
Object.values = Object.values || function (object) {
  return Object.keys(object).map(key => object[key]);
};
