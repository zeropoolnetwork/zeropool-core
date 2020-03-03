include "poseidon.circom";

template merkleproofposeidon(n) {
  signal input sibling[n];
  signal input path[n];
  signal input leaf;
  signal output root;

  component hash[n];

  var node = leaf;

  for(var i = 0; i<n; i++) {
    hash[i] = Poseidon_3(2);
    hash[i].inputs[0] <== sibling[i] + (node - sibling[i]) * (1 - path[i]);
    hash[i].inputs[1] <== sibling[i] + node - hash[i].inputs[0];
    node = hash[i].out;
  }

  root <== node;
}