mnemonic=$1
gas_mnemonic=$2

main_network=''
side_network=''

if [ -n "$3" ]; then
  main_network=$3
else
  main_network=development
fi

if [ -n "$4" ]; then
  side_network=$4
else
  side_network=development
fi

echo 'MainnetProxy'
MNEMONIC=$1 truffle migrate --network $main_network --reset --f 2 --to 2 | sed -n -e 's/^.*\(contract address: \)/\1/p' | tail -1

echo 'SidechainProxy'
MNEMONIC=$2 truffle migrate --network $side_network --reset --f 1 --to 1 | sed -n -e 's/^.*\(contract address: \)/\1/p' | tail -1