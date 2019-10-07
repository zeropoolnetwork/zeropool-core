const _ = require("lodash");
//const poseidon = require("circomlib/src/poseidon.js").createHash(6, 8, 57);
const { multiHash } = require("circomlib/src/mimc7");

const assert = require("assert");


const maxheight = 256;
const merkleDefaults = Array(maxheight);
merkleDefaults[0] = 0n;
for (let i = 1; i < maxheight; i++) {
  merkleDefaults[i] = multiHash([merkleDefaults[i-1], merkleDefaults[i-1]]);
}


class MerkleTree {

  constructor(height) {
    assert(height <= maxheight, "height should be less or equal 256");
    this.height = height;
    this._merkleState = Array(this.height).fill(0).map(() => []);
  }
  _cell(row, index) {
    return index < this._merkleState[row].length ? this._merkleState[row][index] : merkleDefaults[row];
  }

  push(leaf) {
    let pos = this._merkleState[0].length;
    this._merkleState[0][pos] = leaf;
    for (let i = 1; i < this.height; i++) {
      pos = pos >> 1;
      this._merkleState[i][pos] = multiHash([this._cell(i - 1, pos * 2), this._cell(i - 1, pos * 2 + 1)]);
    }
  }

  proof(index) {
    return Array(this.height - 1).fill(0).map((e, i) => this._cell(i, (index >> i) ^ 1));
  }

  static computeRoot(pi, index, leaf) {
    let root = leaf;
    for (let i = 0; i < pi.length; i++) {
      root = ((index >> i) & 1) == 0 ? multiHash([root, pi[i]]) : multiHash([pi[i], root]);
    }
    return root;
  }

  get root() {
    return this._merkleState[this.height - 1][0];
  }

  pushMany(elements) {
    const index = this._merkleState[0].length;
    const s = elements.length;
    assert((index+s)<=(2**(this.height-1)), "too many elements");
    this._merkleState[0].push(...elements);

    for(let i = 1; i < this.height; i++) {
      for(let j = index>>i; j<=(index+s)>>i; j++) {
        this._merkleState[i][j] = multiHash([this._cell(i-1, j*2), this._cell(i-1, j*2+1)]);
      }
    }
  }

  static updateRoot(pi, index, elements) { // js prototype for solidity in-memory tree updater
    const s = elements.length;
    const height = pi.length+1;
    assert((index+s)<=(2**(height-1)), "too many elements");

    let offset = index & 0x1;
    let memframesz = s + offset;
    let memframe = Array(memframesz+1).fill(0n);
    
    
    for (let i = 0; i<s; i++)
      memframe[i+offset] = elements[i];
    
    if (offset > 0)
      memframe[0] = pi[0];
    
    for (let i = 1; i< height; i++) {
      offset = (index >> i) & 0x1;
      for(let j = 0; j<((memframesz+1) >> 1); j++) {
        memframe[j+offset] = multiHash([memframe[j*2], memframe[j*2+1]]);
      }
      
      memframesz = offset + ((memframesz+1) >> 1);
      memframe[memframesz] = merkleDefaults[i];
      
      if (offset > 0)
        memframe[0] = pi[i]
      
      
    }
    return memframe[0];

  }

}

_.assign(exports, { MerkleTree });
