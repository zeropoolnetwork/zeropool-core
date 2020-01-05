const { babyJub, mimc7 } = require("circomlib");
const { bigInt } = require("snarkjs");
const crypto = require("crypto");

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

function encrypt(message, pubkey) {
  const privkey = randrange(0n, babyJub.subOrder);
  const sender_pubkey = babyJub.mulPointEscalar(babyJub.Base8, privkey);
  pubkey = babyJub.subgroupDecompress(pubkey);
  const edh = babyJub.mulPointEscalar(pubkey, privkey)[0];
  const iv = mimc7.multiHash(message, 0n);
  return [sender_pubkey[0], iv, ...message.map((e, i) => e + mimc7.hash(edh, iv + BigInt(i)))];
}

function decrypt(message, privkey) {
  const pubkey = babyJub.subgroupDecompress(message[0]);
  const iv = message[1];
  const edh = babyJub.mulPointEscalar(pubkey, privkey)[0];
  const decrypted_message = message.slice(2).map((e, i) => e - mimc7.hash(edh, iv + BigInt(i)));
  const ivc = mimc7.multiHash(decrypted_message, 0n);
  return iv === ivc ? decrypted_message : null;
}

module.exports = { encrypt, decrypt };
