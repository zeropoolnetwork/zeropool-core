const { babyJub, poseidon } = require("circomlib");
const assert = require("assert");
const {fs_random, subgroupDecompress, get_pubkey} = require("./utils")


const hash2 = poseidon.createHash(2, 8, 53);
const hash3 = poseidon.createHash(3, 8, 53);

function encrypt_message(message, pubkey, iv) {
  assert(message.length === 3);
  const ephemeral_secret = fs_random();
  const ephemeral_public = get_pubkey(ephemeral_secret);

  pubkey = subgroupDecompress(pubkey);
  const edh = babyJub.mulPointEscalar(pubkey, ephemeral_secret)[0];
  return [ephemeral_public, ...message.map((e, i) => e + hash2([edh, iv + BigInt(i)]))];

}

function decrypt_message(encrypted_message, secret, iv) {
  assert(encrypted_message.length === 4);
  const ephemeral_public = encrypted_message[0];
  const pubkey = subgroupDecompress(ephemeral_public);

  const edh = babyJub.mulPointEscalar(pubkey, secret)[0];
  return encrypted_message.slice(1).map((e, i) => e - hash2([edh, iv + BigInt(i)]));
}

module.exports = { encrypt_message, decrypt_message };
