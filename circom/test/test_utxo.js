const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const assert = require("assert");
const {utxo_random, obj_utxo_inputs, utxo_hash} = require("../src/inputs");



describe("UTXO hasing circuit test", function() {
    this.timeout(200000);
    it("Should create a utxo hashing circuit", async () => {

        
        const cirDef = await compiler(path.join(__dirname, "circuits", "test_utxo.circom"));

        const circuit = new snarkjs.Circuit(cirDef);
        const utxo = utxo_random();
        const witness = circuit.calculateWitness(obj_utxo_inputs(utxo));

        assert(witness[1].equals(utxo_hash(utxo)));

    });
});