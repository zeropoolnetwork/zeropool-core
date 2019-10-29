const { MerkleTree } = require("../src/merkletree.js");
const { randrange } = require("../src/utils.js");
const assert = require("assert");

function genRandomState(fixed) {
  const max_test_elements = Math.min(32, 1 << proofLength);
  if (typeof fixed === "undefined") fixed = {};
  const pk = randrange(0n, babyJub.subOrder);
  const owner = pubkey(pk);
  const assetId = fixed.assetId ? randrange(0n, 1n << 16n) : undefined;

  const utxos = Array(max_test_elements).fill(0).map(() => utxoRandom({ assetId, owner }));
  const tree = new MerkleTree(proofLength + 1);
  utxos.forEach(u => tree.push(utxoHash(u)));
  return { pk, utxos, tree };
}


describe("MerkleTree", function () { 
  it("Ading elements one by one and batched need to give the same result", ()=>{
    const proofLength = 10;
    const test_pre_elements = Array(randrange(10, 100)).fill(0n).map(()=>randrange(0n, 0x4fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn));
    const test_elements = Array(randrange(10, 100)).fill(0n).map(()=>randrange(0n, 0x4fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn));

    const tree1 = new MerkleTree(proofLength + 1);
    const tree2 = new MerkleTree(proofLength + 1);
    tree1.pushMany(test_pre_elements);
    tree2.pushMany(test_pre_elements);
    test_elements.forEach(u=>tree1.push(u));
    tree2.pushMany(test_elements);
    assert(tree1.root===tree2.root, "trees must be the same");
  });

  it("Updating root in memory-only mode", ()=>{
    const proofLength = 10;
    const test_pre_elements = Array(randrange(10, 100)).fill(0n).map(()=>randrange(0n, 0x4fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn));
    const test_elements = Array(randrange(10, 100)).fill(0n).map(()=>randrange(0n, 0x4fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn));

    const tree1 = new MerkleTree(proofLength + 1);
    const tree2 = new MerkleTree(proofLength + 1);
    tree1.pushMany(test_pre_elements);
    tree2.pushMany(test_pre_elements);
    
    tree1.pushMany(test_elements);

    const index = test_pre_elements.length;
    const proof = tree2.proof(index);
    const newroot = MerkleTree.updateRoot(proof, index, test_elements);

    assert(tree1.root===newroot, "trees roots must be the same");
  })

  it("Updating root in case updates of elements in the middle of tree", ()=>{
    const proofLength = 5;
    const before = Array(207n, 133n, 83n, 0n, 0n, 0n, 183n, 168n, 12n, 42n, 235n);
    const after = Array(207n, 133n, 83n, 90n, 242n, 181n, 183n, 168n, 12n, 42n, 235n);
    const elements_for_update = Array(90n, 242n, 181n);

    const update_index = 3;
    const tree2 = new MerkleTree(proofLength + 1);
    tree2.pushMany(before);
    const first_update_element_proof = tree2.proof(update_index);
    const newroot = MerkleTree.updateRoot(first_update_element_proof, update_index, elements_for_update);

    const tree1 = new MerkleTree(proofLength + 1);
    tree1.pushMany(after);
    assert(tree1.root===newroot, "trees roots must be the same");
  })

})