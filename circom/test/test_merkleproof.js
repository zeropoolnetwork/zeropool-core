const {MerkleTree} = require("../src/merkletree");
const {fr_random, randrange} = require("../src/utils");
const assert = require("assert");

describe("Merkle proof functions test", function() {
    this.timeout(200000);
    const last = e => e[e.length-1];
    const shift = (a, b) => [a instanceof Array ? a[a.length-1] : a, ... b.slice(0, -1)];
    
    it("Should create and test a merkle proof ", async () => {
        let index = randrange(0, 0xffffffff);
        let proof = MerkleTree.genRandomRightProof(32, index);
        let leaf = fr_random(); 

        let elements0 = Array(randrange(5, 10)).fill(0n).map(_ => fr_random());
        let elements1 = Array(randrange(5, 10)).fill(0n).map(_ => fr_random());
        let elements_all = elements0.concat(elements1);

        let p0 = MerkleTree.updateProof(proof, index, shift(leaf, elements0));
        let p1 = MerkleTree.updateProof(p0, index + elements0.length, shift(elements0, elements1));

        let root01 = MerkleTree.getRoot(p1, index + elements0.length + elements1.length, last(elements1));

        let p_all = MerkleTree.updateProof(proof, index, shift(leaf, elements_all));

        
        let root_all = MerkleTree.getRoot(p_all, index + elements_all.length, last(elements_all));
        assert(root01 == root_all);
    })
})