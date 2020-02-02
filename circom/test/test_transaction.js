const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const assert = require("assert");
const {utxo, utxo_random, obj_utxo_inputs, utxo_hash, transfer_compute, PROOF_LENGTH} = require("../src/inputs");
const {randrange, fr_random, u160_random, fs_random, proof, verify, get_pubkey} = require("../src/utils");
const babyJub = require("circomlib/src/babyjub.js");
const {MerkleTree} = require("../src/merkletree");
const {stringifyBigInts} = require("snarkjs/src/stringifybigint");



describe("Transaction test", function() {
    this.timeout(200000);
    const pick2 = (a,b) => {const t1 = randrange(a,b); const t2 = randrange(a,b-1); return [t1, t1 <= t2 ? t2+1:t2]};
  
    it("Should create a transaction circuit and compute witness", async () => {
        const secret = fs_random();
        const pubkey = get_pubkey(secret);
        const token = u160_random();
        const mt = new MerkleTree(PROOF_LENGTH+1);
        
        const sz = randrange(50, 100);
        const utxos= Array(sz).fill(0n).map(_ => utxo_random({pubkey, token}));
        const utxo_hashes = utxos.map(e=>utxo_hash(e));
        mt.pushMany(utxo_hashes);

        const root = mt.root;
        const utxo_in = pick2(0, sz).map(i => {
            let u = utxos[i];
            u.mp_sibling = mt.proof(i);
            u.mp_path = i;
            return u;
        });

        const input_amount = utxo_in.reduce((a,b) => a + b.amount, 0n);
        

        const utxo_out = [utxo(token, input_amount, pubkey, fr_random())];

        const delta = u160_random();
        const message_hash = fr_random();
        
        
        const {inputs} = transfer_compute(root, utxo_in, utxo_out, token, delta, message_hash, secret);
        const cirDef = await compiler(path.join(__dirname, "..", "circuits", "transaction.circom"));
        const circuit = new snarkjs.Circuit(cirDef);
        const witness = circuit.calculateWitness(inputs);

    });

    it("Should create a transaction circuit and verify", async () => {
        const secret = fs_random();
        const pubkey = get_pubkey(secret);
        const token = u160_random();
        const mt = new MerkleTree(PROOF_LENGTH+1);
        
        const sz = randrange(50, 100);
        const utxos= Array(sz).fill(0n).map(_ => utxo_random({pubkey, token}));
        const utxo_hashes = utxos.map(e=>utxo_hash(e));
        mt.pushMany(utxo_hashes);

        const root = mt.root;
        const utxo_in = pick2(0, sz).map(i => {
            let u = utxos[i];
            u.mp_sibling = mt.proof(i);
            u.mp_path = i;
            return u;
        });

        const input_amount = utxo_in.reduce((a,b) => a + b.amount, 0n);
        

        const utxo_out = [utxo(token, input_amount, pubkey, fr_random())];

        const delta = u160_random();
        const message_hash = fr_random();
        
        
        const {inputs} = transfer_compute(root, utxo_in, utxo_out, token, delta, message_hash, secret);
        const pi = await proof(inputs);
        assert(await verify(pi), 'Verifier should return true');

    });


});

