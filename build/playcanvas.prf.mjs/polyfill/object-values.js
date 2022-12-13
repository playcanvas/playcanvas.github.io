/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
Object.values = Object.values || function (object) {
  return Object.keys(object).map(key => object[key]);
};
