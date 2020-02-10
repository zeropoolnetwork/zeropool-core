pragma solidity >=0.5.2;


library Groth16Verifier {
  uint constant q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
  uint constant r = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

  struct G1Point {
    uint X;
    uint Y;
  }
  // Encoding of field elements is: X[0] * z + X[1]
  struct G2Point {
    uint[2] X;
    uint[2] Y;
  }

  /// @return the sum of two points of G1
  function addition(G1Point memory p1, G1Point memory p2) internal view returns (G1Point memory) {
    G1Point memory t;
    uint[4] memory input;
    input[0] = p1.X;
    input[1] = p1.Y;
    input[2] = p2.X;
    input[3] = p2.Y;
    bool success;
    /* solium-disable-next-line */
    assembly {
      success := staticcall(sub(gas(), 2000), 6, input, 0xc0, t, 0x60)
      // Use "invalid" to make gas estimation work
      switch success case 0 { invalid() }
    }
    require(success);
    return t;
  }

  /// @return the product of a point on G1 and a scalar, i.e.
  /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
  function scalar_mul(G1Point memory p, uint s) internal view returns (G1Point memory) {
    if(s==0) return G1Point(0,0);
    if(s==1) return p;
    G1Point memory t;
    uint[3] memory input;
    input[0] = p.X;
    input[1] = p.Y;
    input[2] = s;
    bool success;
    /* solium-disable-next-line */
    assembly {
      success := staticcall(sub(gas(), 2000), 7, input, 0x80, t, 0x60)
      // Use "invalid" to make gas estimation work
      switch success case 0 { invalid() }
    }
    require (success);
    return t;
  }


  function verify(uint[] memory input, uint[8] memory proof, uint[] memory vk) internal view returns (bool) {
    uint nsignals = (vk.length-16)/2;
    require((nsignals>0) && (input.length == nsignals) && (proof.length == 8) && (vk.length == 16 + 2*nsignals));

    for(uint i=0; i<input.length; i++)
      require(input[i]<r);


    uint[] memory p_input = new uint[](24);

    p_input[0] = proof[0];
    p_input[1] = q-(proof[1]%q);  //proof.A negation
    p_input[2] = proof[2];
    p_input[3] = proof[3];
    p_input[4] = proof[4];
    p_input[5] = proof[5];

    // alpha1 computation
    p_input[6] = vk[0];     //vk.alfa1 == G1Point(vk[0], vk[1])
    p_input[7] = vk[1];


    p_input[8] = vk[2];
    p_input[9] = vk[3];
    p_input[10] = vk[4];
    p_input[11] = vk[5];

    //vk_x computation
    G1Point memory t = G1Point(vk[14], vk[15]);  //vk.IC[0] == G1Point(vk[14], vk[15])
    for(uint j = 0; j < nsignals; j++)
      t = addition(t, scalar_mul(G1Point(vk[16+2*j], vk[17+2*j]), input[j]));  //vk.IC[j + 1] == G1Point(vk[16+2*j], vk[17+2*j])

    p_input[12] = t.X;
    p_input[13] = t.Y;

    p_input[14] = vk[6];
    p_input[15] = vk[7];
    p_input[16] = vk[8];
    p_input[17] = vk[9];

    //C computation
    p_input[18] = proof[6];   //proof.C == G1Point(proof[6], proof[7])
    p_input[19] = proof[7];

    p_input[20] = vk[10];
    p_input[21] = vk[11];
    p_input[22] = vk[12];
    p_input[23] = vk[13];


    uint[1] memory out;
    bool success;
    // solium-disable-next-line 
    assembly {
      success := staticcall(sub(gas(), 2000), 8, add(p_input, 0x20), 768, out, 0x20)
      // Use "invalid" to make gas estimation work
      switch success case 0 { invalid() }
    }

    require(success);
    return out[0] != 0;
  }

}