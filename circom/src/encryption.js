const { babyJub, poseidon } = require("circomlib");
const { bigInt } = require("snarkjs");
const crypto = require("crypto");
const assert = require("assert");

function randrange(from, to) {
  if (from === to)
    return from;
  if (from > to)
    [from, to] = [to, from];
  const interval = to - from;

  if (typeof from === "number")
    return from + Math.floor(Math.random() * interval);

  let t = 0;
  while (interval > bigInt.one.shl(t))
    t++;
  return from + bigInt.leBuff2int(crypto.randomBytes(t)) % interval;
}

const hash2 = poseidon.createHash(2, 8, 53);
const hash3 = poseidon.createHash(3, 8, 53);

function encrypt_message(message, pubkey) {
    assert(message.length == 3);
    const privkey = randrange(0n, babyJub.subOrder);
    const sender_pubkey = babyJub.mulPointEscalar(babyJub.Base8, privkey);
    pubkey = babyJub.subgroupDecompress(pubkey);
    const edh = babyJub.mulPointEscalar(pubkey, privkey)[0];
    const iv = hash3(message);
    return [sender_pubkey[0], iv, ...message.map((e, i) => e + hash2(edh, iv + BigInt(i)))];
}

function decrypt_message(message, privkey) {
    const pubkey = babyJub.subgroupDecompress(message[0]);
    const iv = message[1];
    const edh = babyJub.mulPointEscalar(pubkey, privkey)[0];
    const decrypted_message = message.slice(2).map((e, i) => e - hash2(edh, iv + BigInt(i)));
    assert(decrypt_message.length == 3);
    const ivc = hash3(decrypted_message);
    return iv === ivc ? decrypted_message : null;
}

module.exports = { encrypt_message, decrypt_message };
