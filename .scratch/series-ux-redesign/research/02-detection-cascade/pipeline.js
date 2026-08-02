'use strict';
const { detect } = require('./cascade.js'); const { refine } = require('./refine.js');
const { splitOnNumberCollision, dropSingletons } = require('./collision.js');
/** FIDELITY: 'conservative' = tags + self-validated folders. 'full' = + uncorroborated folders. */
function run(units, fidelity = 'conservative') {
  const opts = { trustFolders: true, acceptUncorroborated: fidelity === 'full' ? 3 : 0 };
  let r = refine(detect(units, opts).results, units);
  r = splitOnNumberCollision(r, units);
  r = dropSingletons(r);
  return r;
}
module.exports = { run };
