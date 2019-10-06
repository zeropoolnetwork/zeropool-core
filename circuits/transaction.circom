include "../node_modules/circomlib/circuits/merkleproofposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/compconstant.circom";
include "../node_modules/circomlib/circuits/pointbits.circom";
include "../node_modules/circomlib/circuits/pedersen.circom";
include "utxo.circom";


template MulEqZero(n) {
  signal input in[n];
  if (n==1){
    in[0]===0;
  } else if (n==2){
    in[0]*in[1]===0;
  } else if (n > 2) {
    signal t[n-2];
    t[0] <== in[0]*in[1];
    for(var j=2; j<(n-1);j++) {
      t[j-1] <== t[j-2]*in[j];
    }
    0 === t[n-3]*in[n-1];
  }
}

template Nullifier() {
  signal input uid;     // 253 bit
  signal input privkey; // 251 bit
  signal output out;    // 254 bit

  var BABYJUB_SUBORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

  component uid_bits = Num2Bits(253);
  uid_bits.in <== uid;

  component privkey_bits = Num2Bits(251);
  privkey_bits.in <== privkey;

  component privkey_alias = CompConstant(BABYJUB_SUBORDER-1);
  for (var i=0; i<251; i++) {
    privkey_alias.in[i] <== privkey_bits.out[i];
  }
  for (var i = 251; i<254; i++) {
    privkey_alias.in[i] <== 0;
  }
  privkey_alias.out === 0;

  component h1 = Pedersen(504);
  for(var i=0; i<253; i++) {
    h1.in[i] <== uid_bits.out[i];
  }

  for(var i=0; i<251; i++) {
    h1.in[i+253] <== privkey_bits.out[i];
  }

  component h1_bits = Num2Bits_strict();
  h1_bits.in <== h1.out[0];

  component h2 = Pedersen(254);
  for(var i = 0; i< 254; i++) {
    h2.in[i] <== h1_bits.out[i];
  }
  out <== h2.out[0];
}

template transaction(n) {
  signal input root;
  signal input n0;
  signal input n1_or_u_in;
  signal input out_u0;
  signal input out_u1_or_asset;
  signal input txtype;

  signal private input mp_sibling[2][n]; 
  signal private input mp_path[2]; 
  signal private input utxo_in[2][4];
  signal private input utxo_out[2][5];
  signal private input privkey;

  var G8 = [
    5299619240641551281634865583518297030282874472190772894086521144482721001553,
    16950150798460657717958625567821834550301663161624707787222815936182638968203
  ];

  component txtype_bits = Num2Bits(226);
  txtype_bits.in <== txtype;

  component fee = Bits2Num(64);
  for (var i = 0; i < 64; i++) {
    fee.in[i] <== txtype_bits.out[160+i];
  }

  signal is_deposit; 
  signal is_withdrawal;
  signal is_transfer;
  signal is_swap;

  var b0=txtype_bits.out[224];
  var b1=txtype_bits.out[225];
  is_swap <== b0 * b1;  
  is_deposit <== is_swap + 1 - b0 - b1;  
  is_withdrawal <== - is_swap + b0;  
  is_transfer <== - is_swap + b1;  
  

  root*is_deposit === 0;
  n0*is_deposit === 0;
  n1_or_u_in*is_deposit === 0;

  for(var i=0; i<n; i++) {
    mp_sibling[0][i]*is_deposit === 0;
    mp_sibling[1][i]*(is_deposit+is_swap) === 0;
  }

  for(var i=0; i<4; i++) {
    utxo_in[0][i]*is_deposit === 0;
    utxo_in[1][i]*is_deposit === 0;
  }

  for(var i=0; i<5; i++) {
    utxo_out[1][i]*(is_deposit+is_withdrawal) === 0;
  }

  privkey*is_deposit === 0;



  component pubkey = EscalarMulFix(251, G8);
  component privkey_bits = Num2Bits(251);
  privkey_bits.in <== privkey;
  for(var i=0; i<251; i++){
    pubkey.e[i] <== privkey_bits.out[i];
  }

  component asset_bits = Num2Bits(144);
  asset_bits.in <== out_u1_or_asset * (is_deposit+is_withdrawal);

  component assetId = Bits2Num(16);
  for(var i=0; i<16; i++) {
    assetId.in[i] <== asset_bits.out[i];
  }

  component assetAmount = Bits2Num(64);
  for(var i=0; i<64; i++) {
    assetAmount.in[i] <== asset_bits.out[i+16];
  }

  component assetNativeAmount = Bits2Num(64);
  for(var i=0; i<64; i++) {
    assetNativeAmount.in[i] <== asset_bits.out[i+80];
  }

  component utxo_in_hash[2];

  utxo_in_hash[0]=utxo();
  utxo_in_hash[0].in[0] <== utxo_in[0][0] + (assetId.out-utxo_in[0][0])*is_deposit;
  utxo_in_hash[0].in[1] <== utxo_in[0][1] + (assetAmount.out-utxo_in[0][1])*is_deposit;
  utxo_in_hash[0].in[2] <== utxo_in[0][2] + (assetNativeAmount.out-utxo_in[0][2])*is_deposit;
  utxo_in_hash[0].in[3] <== utxo_in[0][3];
  utxo_in_hash[0].in[4] <== pubkey.out[0]; 


  utxo_in_hash[1]=utxo();
  for(var i=0; i<4; i++){
    utxo_in_hash[1].in[i] <== utxo_in[1][i];
  }
  utxo_in_hash[1].in[4] <== pubkey.out[0];

  component doublespend = IsZero();
  doublespend.in <== utxo_in_hash[0].out - utxo_in_hash[1].out;
  doublespend.out === 0;

  component mp_path_bits[2];
  component merkleproof[2];
  
  for(var j=0; j<2; j++) {
    mp_path_bits[j] = Num2Bits(n);
    mp_path_bits[j].in <== mp_path[j];
    merkleproof[j]=merkleproofposeidon(n);
    merkleproof[j].leaf <== utxo_in_hash[j].out;
    for(var i=0; i<n; i++) {
      merkleproof[j].sibling[i] <== mp_sibling[j][i];
      merkleproof[j].path[i] <== mp_path_bits[j].out[i];
    }
  }

  component root0expr = MulEqZero(3);
  root0expr.in[0] <== merkleproof[0].root-root;
  root0expr.in[1] <== is_withdrawal+is_transfer+is_swap;
  root0expr.in[2] <== utxo_in_hash[0].in[1]+utxo_in_hash[0].in[2];

  component root1expr = MulEqZero(3);
  root1expr.in[0] <== merkleproof[1].root-root;
  root1expr.in[1] <== is_withdrawal+is_transfer;
  root1expr.in[2] <== utxo_in_hash[1].in[1]+utxo_in_hash[1].in[2];

  (n1_or_u_in - utxo_in_hash[1].out)*is_swap === 0;


  component utxo_out_hash[2];

  utxo_out_hash[0]=utxo();
  for(var i=0; i<5; i++){
    utxo_out_hash[0].in[i]<==utxo_out[0][i];
  }

  utxo_out_hash[1]=utxo();
  utxo_out_hash[1].in[0]<==utxo_out[1][0] + (assetId.out - utxo_out[1][0]) * is_withdrawal;
  utxo_out_hash[1].in[1]<==utxo_out[1][1] + (assetAmount.out - utxo_out[1][1]) * is_withdrawal;
  utxo_out_hash[1].in[2]<==utxo_out[1][2] + (assetNativeAmount.out - utxo_out[1][2]) * is_withdrawal;
  utxo_out_hash[1].in[3]<==utxo_out[1][3];
  utxo_out_hash[1].in[4]<==utxo_out[1][4];

  

  out_u0 === utxo_out_hash[0].out;
  (out_u1_or_asset - utxo_out_hash[1].out) * (is_transfer + is_swap) === 0;

  component sameAssets = IsZero();
  sameAssets.in <== utxo_in_hash[0].in[0] - utxo_in_hash[1].in[0];

  utxo_in_hash[0].in[1] + utxo_in_hash[1].in[1] - utxo_out_hash[0].in[1] - utxo_out_hash[1].in[1] === 0;
  utxo_in_hash[0].in[2] + utxo_in_hash[1].in[2] - utxo_out_hash[0].in[2] - utxo_out_hash[1].in[2] - fee.out === 0;
  
  (utxo_in_hash[0].in[1] - utxo_out_hash[0].in[1])*(1-sameAssets.out) === 0;

  utxo_in_hash[0].in[0] === utxo_out_hash[0].in[0];
  utxo_in_hash[1].in[0] === utxo_out_hash[1].in[0];

  component cn0 = Nullifier();
  cn0.uid <== utxo_in_hash[0].in[3];
  cn0.privkey <== privkey;

  (cn0.out - n0)*(is_withdrawal+is_transfer+is_swap) === 0;

  component cn1 = Nullifier();
  cn1.uid <== utxo_in_hash[1].in[3];
  cn1.privkey <== privkey;
  
  (cn1.out - n1_or_u_in)*(is_withdrawal+is_transfer) === 0;

}

component main = transaction(2)