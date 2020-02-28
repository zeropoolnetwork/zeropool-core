mkdir -p circuitsCompiled
npx circom ./circuits/transaction.circom -o ./circuitsCompiled/transaction.json
npx snarkjs setup -c ./circuitsCompiled/transaction.json --pk ./circuitsCompiled/transaction_pk.json --vk circuitsCompiled/transaction_vk.json --protocol groth
node ./node_modules/websnark/tools/buildpkey.js -i circuitsCompiled/transaction_pk.json -o circuitsCompiled/transaction_pk.bin

npx circom ./circuits/treebuilder.circom -o ./circuitsCompiled/treebuilder.json
npx snarkjs setup -c ./circuitsCompiled/treebuilder.json --pk ./circuitsCompiled/treebuilder_pk.json --vk circuitsCompiled/treebuilder_vk.json --protocol groth
node ./node_modules/websnark/tools/buildpkey.js -i circuitsCompiled/treebuilder_pk.json -o circuitsCompiled/treebuilder_pk.bin