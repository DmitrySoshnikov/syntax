/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import colors from 'colors';

function emptyFn() {}

/**
 * Debug module.
 */
const Debug = {
  string(message) {
    return `${colors.bold('[DEBUG]')} ${message}`;
  },

  log(message) {
    console.log(Debug.string(message));
  },

  time(label) {
    console.time(this.string(label));
  },

  timeEnd(label) {
    console.timeEnd(this.string(label));
  },
};

if (!global.SYNTAX_DEBUG) {
  Object.keys(Debug).forEach(method => Debug[method] = emptyFn);
}

export default Debug;
