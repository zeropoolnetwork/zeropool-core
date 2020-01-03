const _ = require("lodash");

const {MerkleTree} = require("./merkletree.js");
const utils = require("./utils.js");
const inputs = require("./inputs.js");
const buildpkey = require("./buildpkey.js");
const buildwitness = require("./buildwitness.js");

_.assign(exports, {
  utils,
  inputs,
  MerkleTree,
  buildpkey,
  buildwitness,
});
