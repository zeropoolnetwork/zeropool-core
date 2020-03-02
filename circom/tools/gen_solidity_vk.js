const {linearize_vk_verifier} = require("../src/utils");
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs/src/stringifybigint");
const path = require("path");

const fs = require("fs");

const transaction_vk = linearize_vk_verifier(unstringifyBigInts(JSON.parse(fs.readFileSync(path.join(__dirname, "../circuitsCompiled/transaction_vk.json")))));
const treebuilder_vk = linearize_vk_verifier(unstringifyBigInts(JSON.parse(fs.readFileSync(path.join(__dirname, "../circuitsCompiled/treebuilder_vk.json")))));


console.log(`
// generated verification keys

function get_tx_vk() internal view override returns(VK memory vk) {
    vk.data = new uint256[](${transaction_vk.length});
${(()=>{
        let rows = [];
        for(let i = 0; i< transaction_vk.length; i++)
            rows.push(`\tvk.data[${i}]=${transaction_vk[i]};\n`);
        return rows.join("");
    })()}
}

function get_tree_update_vk() internal view override returns(VK memory vk) {
    vk.data = new uint256[](${treebuilder_vk.length});
${(()=>{
        let rows = [];
        for(let i = 0; i< treebuilder_vk.length; i++)
            rows.push(`\tvk.data[${i}]=${treebuilder_vk[i]};\n`);
        return rows.join("");
    })()}
}
`);