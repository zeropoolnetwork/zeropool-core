const _ = require("lodash");
const poseidon = require("circomlib/src/poseidon.js").createHash(6, 8, 57);

class MerkleTree {
  constructor(height) {
    this.height = height;
    this._merkleState = Array(this.height).fill(0).map(() => []);
    this._merkleDefaults = Array(this.height);
    this._merkleDefaults[0] = 0n;
    for (let i = 1; i < this.height; i++) {
      this._merkleDefaults[i] = poseidon([this._merkleDefaults[i - 1], this._merkleDefaults[i - 1]]);
    }
  }
  _cell(row, index) {
    return index < this._merkleState[row].length ? this._merkleState[row][index] : this._merkleDefaults[row];
  }

  push(leaf) {
    let pos = this._merkleState[0].length;
    this._merkleState[0][pos] = leaf;
    for (let i = 1; i < this.height; i++) {
      pos = pos >> 1;
      this._merkleState[i][pos] = poseidon([this._cell(i - 1, pos * 2), this._cell(i - 1, pos * 2 + 1)]);
    }
  }

  proof(index) {
    return Array(this.height - 1).fill(0).map((e, i) => this._cell(i, (index >> i) ^ 1));
  }

  static computeRoot(pi, index, leaf) {
    let root = leaf;
    for (let i = 0; i < pi.length; i++) {
      root = ((index >> i) & 1) == 0 ? poseidon([root, pi[i]]) : poseidon([pi[i], root]);
    }
    return root;
  }

  get root() {
    return this._merkleState[this.height - 1][0];
  }
}

_.assign(exports, { MerkleTree });
