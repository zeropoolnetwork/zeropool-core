## MyUtxoState
1. Fetch UTXO List from contract
2. Find spent utxo
3. Find own utxo

## PrepareBlockItem
1. Compute transfer
2. Get proof
3. Get last root pointer


## getBalance
0: Start

1-3: Update [MyUtxoState](#myutxostate)

4: Calculate balances

5: Finish


## transfer
0: Start

1-3: Update [MyUtxoState](#myutxostate)  

4: Calculate UtxoIn and UtxoOut  

5-7: [PrepareBlockItem](#prepareblockitem)

## deposit
0: Start

1-3: Update [MyUtxoState](#myutxostate)  

4-6: [PrepareBlockItem](#prepareblockitem)

7: Deposit asset to contract

8: Finish

## prepareWithdraw
0: Start

1-3: Update [MyUtxoState](#myutxostate)  

4-6: [PrepareBlockItem](#prepareblockitem)


