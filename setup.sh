npx circom circuits/transaction.circom -o circuitsCompiled/transaction.json
npx snarkjs setup -c circuitsCompiled/transaction.json --pk circuitsCompiled/transaction_pk.json --vk circuitsCompiled/transaction_vk.json --protocol groth
node node_modules/websnark/tools/buildpkey.js -i circuitsCompiled/transaction_pk.json -o circuitsCompiled/transaction_pk.bin
