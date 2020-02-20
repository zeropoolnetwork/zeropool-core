const Poseidon = require("./poseidon.js");

let t = parseInt(process.argv[2]);
let rf = parseInt(process.argv[3]);
let rp = parseInt(process.argv[4]);


const M = Poseidon.getMatrix(t, "poseidon", rf+rp);

let S = "var M = [\n    ";

for (let i=0; i<M.length; i++) {
    const LC = M[i];
    S = S + "[\n";
    for (let j=0; j<LC.length; j++) {
        S = S + "        " + M[i][j].toString();
        if (j<LC.length-1) S = S + ",";
        S = S + "\n";
    }
    S = S + "    ]";
    if (i<M.length-1) S = S + ",";
}
S=S+ "\n];\n";

console.log(S);



const C = Poseidon.getConstants(t, "poseidon", rf+rp);

S = "var C = [\n";

for (let i=0; i<C.length; i++) {
    S = S + "    " + C[i].toString();
    if (i<C.length-1) S = S + ",";
    S = S + "\n";
}
S=S+ "];\n";

console.log(S);