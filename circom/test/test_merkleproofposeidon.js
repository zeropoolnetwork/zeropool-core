const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const bigInt = snarkjs.bigInt;
const poseidon = require("circomlib/src/poseidon.js").createHash(2, 8, 53);
const babyJub = require("circomlib/src/babyjub.js");

const compiler = require("circom");

const assert = chai.assert;

const crypto = require("crypto");

const randrange = function(from, to) {
    if (from == to)
        return from;

    if (from > to) 
        [from, to] = [to, from];
    
    const interval = to - from;

    let t = 0;
    while (interval>bigInt.one.shl(t)) 
        t++;
    

    return from + bigInt.leBuff2int(crypto.randomBytes(t)) % interval;
}


describe("Merkle proof circuit test", function() {
    this.timeout(200000);
  
    it("Should create and test a merkle proof circuit", async () => {

        const n = 10;
        const leaf = randrange(0n, babyJub.p);
        const _path = Array(n).fill(0).map(x=>Math.random()<0.5?1n:0n);
        const sibling = Array(n);
        let root = leaf;
        for(let i=0; i<n; i++){
          sibling[i] = randrange(0n, babyJub.p);
          root = _path[i]==0n ? poseidon([root, sibling[i]]) : poseidon([sibling[i], root]);
        }
        
        const cirDef = await compiler(path.join(__dirname, "circuits", "test_merkleproofposeidon.circom"));

        const circuit = new snarkjs.Circuit(cirDef);
        const witness = circuit.calculateWitness( {sibling, path:_path, leaf});

        assert(witness[1].equals(root));

    });
});