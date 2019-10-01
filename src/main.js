const fs = require('fs')
const buildpkey = require('./buildpkey')
const data = require('/Users/artem/eth-boston/proving_key.json')

// console.log('Hi!');

const z = buildpkey(data)
fs.writeFileSync('./prover_key_compressed.data', Buffer.from(z))
