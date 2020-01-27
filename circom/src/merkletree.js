const _ = require("lodash");
const hash2 = require("circomlib/src/poseidon.js").createHash(2, 8, 53);
const {fr_random} = require("./utils");

const assert = require("assert");


const maxheight = 256;
const merkleDefaults = Array(maxheight);
merkleDefaults[0] = 0n;
for (let i = 1; i < maxheight; i++) {
  merkleDefaults[i] = hash2([merkleDefaults[i-1], merkleDefaults[i-1]]);
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
      pos = pos >>> 1;
      this._merkleState[i][pos] = hash2([this._cell(i - 1, pos * 2), this._cell(i - 1, pos * 2 + 1)]);
    }
  }

  proof(index) {
    return Array(this.height - 1).fill(0).map((e, i) => this._cell(i, (index >>> i) ^ 1));
  }

  static computeRoot(pi, index, leaf) {
    let root = leaf;
    for (let i = 0; i < pi.length; i++) {
      root = ((index >>> i) & 1) == 0 ? hash2([root, pi[i]]) : hash2([pi[i], root]);
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
      for(let j = index>>>i; j<=(index+s)>>>i; j++) {
        this._merkleState[i][j] = hash2([this._cell(i-1, j*2), this._cell(i-1, j*2+1)]);
      }
    }
  }
/*
  static updateRoot(pi, index, elements) { 
    index = BigInt(index);
    const s = BigInt(elements.length);
    const height = BigInt(pi.length)+1n;
    assert((index+s)<=(1n << (height-1n)), "too many elements");

    let offset = index & 1n;
    let memframesz = s + offset;
    let memframe = Array(parseInt(memframesz)+1).fill(0n);
    
    for (let i = 0n; i<s; i++)
      memframe[i+offset] = elements[i];
    
    if (offset > 0n)
      memframe[0] = pi[0];
    
    for (let i = 1n; i< height; i++) {
      offset = (index >> i) & 1n;
      for(let j = 0n; j<((memframesz+1n) >> 1n); j++) {
        memframe[j+offset] = hash2([memframe[j*2n], memframe[j*2n+1n]]);
      }
      
      memframesz = offset + ((memframesz+1n) >> 1n);
      if ((memframesz&1n) == 1n)
        memframe[memframesz] = merkleDefaults[i];
      
      if (offset > 0n)
        memframe[0] = pi[i]
      
      
    }
    return memframe[0];
  }

*/


  static updateProof(sibling, index, elements) {
    index = BigInt(index);
    let proofsz = BigInt(sibling.length);
    let elementssz = BigInt(elements.length);
    let index2 = index + elementssz;
    let maxproofsz = merkleDefaults.length;
    assert(proofsz <= maxproofsz, "too many long proof");
    assert(index2 < 1n << BigInt(proofsz), "too many elements");
    let sibling2 = [];
  
    if (elementssz == 0n) {
      for (let i = 0n; i < proofsz; i++) {
          sibling2.push(sibling[i]);
      }
    } else {
      let offset = index & 1n;
      let buffsz = offset + elementssz;
      let buffsz_was_odd = (buffsz & 1n) == 1n;
  
      let buff = [];
      
      if (offset > 0n) {
          buff.push(sibling[0]);
      }
      
      for (let i = 0n; i< elementssz; i++) {
          buff.push(elements[i]);
      }
  
      if (buffsz_was_odd) {
          buff.push(merkleDefaults[0]);
          buffsz ++;
      }
  
      let sibling2_i = offset + (index2 ^ 1n) - index;
      sibling2.push(sibling2_i >= buffsz ? merkleDefaults[0] : buff[sibling2_i]);
  
      for(let i = 1n; i < proofsz; i++) {
          offset = (index >> i) & 1n;
          for(let j = 0n; j < buffsz >> 1n; j++)
              buff[offset+j] = hash2([buff[j*2n], buff[j*2n+1n]]);
        
          if (offset > 0n) {
              buff[0] = sibling[i];
          }
  
          buffsz = offset + (buffsz>>1n);
          buffsz_was_odd = (buffsz & 1n) == 1n;
          if (buffsz_was_odd) {
              buff[buffsz] = merkleDefaults[i];
              buffsz ++;
          } 
  
          sibling2_i = offset + (((index2 >> i) ^ 1n) - (index >> i));
          sibling2.push(sibling2_i >= buffsz ? merkleDefaults[i] : buff[sibling2_i] );
      };
    }
  
    return sibling2;
  
  }


  static getRoot(proof, index, leaf) {
      let root = leaf;
      for(let i in proof) {
          root = (index >>> i) & 0x1 == 1 ? hash2([proof[i], root]) : hash2([root, proof[i]]);
      }
      return root;
  }

  static genRandomRightProof(length, index) {
      let pi = Array(length).fill(0n);
      for (let i=0; i<length; i++) {
          pi[i] = (index >>> i) & 0x1 == 1 ? fr_random() : merkleDefaults[i];
      }
      return pi;
  }

}

module.exports = {MerkleTree, merkleDefaults}
