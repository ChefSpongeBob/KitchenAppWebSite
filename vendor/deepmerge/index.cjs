'use strict';

// Based on deepmerge 4.3.1 dist/cjs.js (MIT). See LICENSE.
// Local build-only fix for https://github.com/advisories/GHSA-gcqx-w48m-w2h4.
function isMergeableObject(value) {
  if (!value || typeof value !== 'object') return false;
  const tag = Object.prototype.toString.call(value);
  const reactType = typeof Symbol === 'function' && Symbol.for
    ? Symbol.for('react.element') : 0xeac7;
  return tag !== '[object RegExp]' && tag !== '[object Date]' && value.$$typeof !== reactType;
}

function emptyTarget(value) {
  return Array.isArray(value) ? [] : {};
}

function cloneUnlessOtherwiseSpecified(value, options) {
  return options.clone !== false && options.isMergeableObject(value)
    ? deepmerge(emptyTarget(value), value, options) : value;
}

function defaultArrayMerge(target, source, options) {
  return target.concat(source).map(value => cloneUnlessOtherwiseSpecified(value, options));
}

function getMergeFunction(key, options) {
  const custom = options.customMerge && options.customMerge(key);
  return typeof custom === 'function' ? custom : deepmerge;
}

function getKeys(value) {
  return Object.keys(value).concat(Object.getOwnPropertySymbols(value)
    .filter(key => Object.prototype.propertyIsEnumerable.call(value, key)));
}

function keyIsForbidden(key) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function propertyIsOnObject(object, key) {
  try {
    return key in object;
  } catch {
    return object !== null && (typeof object === 'object' || typeof object === 'function');
  }
}

function propertyIsUnsafe(target, key) {
  if (keyIsForbidden(key)) return true;
  try {
    return key in target && !(Object.prototype.hasOwnProperty.call(target, key)
      && Object.prototype.propertyIsEnumerable.call(target, key));
  } catch {
    // A primitive/null target has no inherited property to merge; reject throwing proxies.
    return target !== null && (typeof target === 'object' || typeof target === 'function');
  }
}

function setOwnProperty(destination, key, value) {
  Object.defineProperty(destination, key, {
    value, writable: true, enumerable: true, configurable: true
  });
}

function mergeObject(target, source, options) {
  const destination = {};
  if (options.isMergeableObject(target)) {
    for (const key of getKeys(target)) {
      if (keyIsForbidden(key)) continue;
      setOwnProperty(destination, key, cloneUnlessOtherwiseSpecified(target[key], options));
    }
  }
  for (const key of getKeys(source)) {
    if (propertyIsUnsafe(target, key)) continue;
    const value = propertyIsOnObject(target, key) && options.isMergeableObject(source[key])
      ? getMergeFunction(key, options)(target[key], source[key], options)
      : cloneUnlessOtherwiseSpecified(source[key], options);
    setOwnProperty(destination, key, value);
  }
  return destination;
}

function deepmerge(target, source, options) {
  options = options || {};
  options.arrayMerge = options.arrayMerge || defaultArrayMerge;
  options.isMergeableObject = options.isMergeableObject || isMergeableObject;
  options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
  const sourceIsArray = Array.isArray(source);
  if (sourceIsArray !== Array.isArray(target)) return cloneUnlessOtherwiseSpecified(source, options);
  return sourceIsArray ? options.arrayMerge(target, source, options) : mergeObject(target, source, options);
}

deepmerge.all = function (array, options) {
  if (!Array.isArray(array)) throw new Error('first argument should be an array');
  return array.reduce((previous, next) => deepmerge(previous, next, options), {});
};

module.exports = deepmerge;
