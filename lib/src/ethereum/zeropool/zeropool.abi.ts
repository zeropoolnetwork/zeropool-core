import { AbiItem } from 'web3-utils';

export const ZeroPoolAbi: AbiItem[] = [{
    "anonymous": false,
    "inputs": [],
    "name": "Deposit",
    "type": "event"
}, { "anonymous": false, "inputs": [], "name": "NewBlockPack", "type": "event" }, {
    "inputs": [],
    "name": "alive",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [{
        "components": [{
            "internalType": "bytes32[8]",
            "name": "proof",
            "type": "bytes32[8]"
        }, {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
        }, {
            "components": [{
                "components": [{
                    "internalType": "uint256",
                    "name": "rootptr",
                    "type": "uint256"
                }, {
                    "internalType": "uint256[2]",
                    "name": "nullifier",
                    "type": "uint256[2]"
                }, {
                    "internalType": "uint256[2]",
                    "name": "utxo",
                    "type": "uint256[2]"
                }, {
                    "internalType": "contract IERC20",
                    "name": "token",
                    "type": "address"
                }, {
                    "internalType": "uint256",
                    "name": "delta",
                    "type": "uint256"
                }, {
                    "components": [{
                        "internalType": "address",
                        "name": "owner",
                        "type": "address"
                    }, {
                        "components": [{ "internalType": "uint256[4]", "name": "data", "type": "uint256[4]" }],
                        "internalType": "struct OptimisticRollup.Message[2]",
                        "name": "message",
                        "type": "tuple[2]"
                    }], "internalType": "struct OptimisticRollup.TxExternalFields", "name": "ext", "type": "tuple"
                }, {
                    "components": [{ "internalType": "uint256[8]", "name": "data", "type": "uint256[8]" }],
                    "internalType": "struct OptimisticRollup.Proof",
                    "name": "proof",
                    "type": "tuple"
                }], "internalType": "struct OptimisticRollup.Tx", "name": "ctx", "type": "tuple"
            }, { "internalType": "uint256", "name": "new_root", "type": "uint256" }, {
                "internalType": "uint256",
                "name": "deposit_blocknumber",
                "type": "uint256"
            }], "internalType": "struct OptimisticRollup.BlockItem", "name": "item", "type": "tuple"
        }], "internalType": "struct OptimisticRollup.BlockItemNote", "name": "cur", "type": "tuple"
    }, {
        "components": [{
            "internalType": "bytes32[8]",
            "name": "proof",
            "type": "bytes32[8]"
        }, {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
        }, {
            "components": [{
                "components": [{
                    "internalType": "uint256",
                    "name": "rootptr",
                    "type": "uint256"
                }, {
                    "internalType": "uint256[2]",
                    "name": "nullifier",
                    "type": "uint256[2]"
                }, {
                    "internalType": "uint256[2]",
                    "name": "utxo",
                    "type": "uint256[2]"
                }, {
                    "internalType": "contract IERC20",
                    "name": "token",
                    "type": "address"
                }, {
                    "internalType": "uint256",
                    "name": "delta",
                    "type": "uint256"
                }, {
                    "components": [{
                        "internalType": "address",
                        "name": "owner",
                        "type": "address"
                    }, {
                        "components": [{ "internalType": "uint256[4]", "name": "data", "type": "uint256[4]" }],
                        "internalType": "struct OptimisticRollup.Message[2]",
                        "name": "message",
                        "type": "tuple[2]"
                    }], "internalType": "struct OptimisticRollup.TxExternalFields", "name": "ext", "type": "tuple"
                }, {
                    "components": [{ "internalType": "uint256[8]", "name": "data", "type": "uint256[8]" }],
                    "internalType": "struct OptimisticRollup.Proof",
                    "name": "proof",
                    "type": "tuple"
                }], "internalType": "struct OptimisticRollup.Tx", "name": "ctx", "type": "tuple"
            }, { "internalType": "uint256", "name": "new_root", "type": "uint256" }, {
                "internalType": "uint256",
                "name": "deposit_blocknumber",
                "type": "uint256"
            }], "internalType": "struct OptimisticRollup.BlockItem", "name": "item", "type": "tuple"
        }], "internalType": "struct OptimisticRollup.BlockItemNote", "name": "prev", "type": "tuple"
    }],
    "name": "challengeDoubleSpend",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [{
        "components": [{
            "internalType": "bytes32[8]",
            "name": "proof",
            "type": "bytes32[8]"
        }, {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
        }, {
            "components": [{
                "components": [{
                    "internalType": "uint256",
                    "name": "rootptr",
                    "type": "uint256"
                }, {
                    "internalType": "uint256[2]",
                    "name": "nullifier",
                    "type": "uint256[2]"
                }, {
                    "internalType": "uint256[2]",
                    "name": "utxo",
                    "type": "uint256[2]"
                }, {
                    "internalType": "contract IERC20",
                    "name": "token",
                    "type": "address"
                }, {
                    "internalType": "uint256",
                    "name": "delta",
                    "type": "uint256"
                }, {
                    "components": [{
                        "internalType": "address",
                        "name": "owner",
                        "type": "address"
                    }, {
                        "components": [{ "internalType": "uint256[4]", "name": "data", "type": "uint256[4]" }],
                        "internalType": "struct OptimisticRollup.Message[2]",
                        "name": "message",
                        "type": "tuple[2]"
                    }], "internalType": "struct OptimisticRollup.TxExternalFields", "name": "ext", "type": "tuple"
                }, {
                    "components": [{ "internalType": "uint256[8]", "name": "data", "type": "uint256[8]" }],
                    "internalType": "struct OptimisticRollup.Proof",
                    "name": "proof",
                    "type": "tuple"
                }], "internalType": "struct OptimisticRollup.Tx", "name": "ctx", "type": "tuple"
            }, { "internalType": "uint256", "name": "new_root", "type": "uint256" }, {
                "internalType": "uint256",
                "name": "deposit_blocknumber",
                "type": "uint256"
            }], "internalType": "struct OptimisticRollup.BlockItem", "name": "item", "type": "tuple"
        }], "internalType": "struct OptimisticRollup.BlockItemNote", "name": "cur", "type": "tuple"
    }, {
        "components": [{
            "internalType": "bytes32[8]",
            "name": "proof",
            "type": "bytes32[8]"
        }, {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
        }, {
            "components": [{
                "components": [{
                    "internalType": "uint256",
                    "name": "rootptr",
                    "type": "uint256"
                }, {
                    "internalType": "uint256[2]",
                    "name": "nullifier",
                    "type": "uint256[2]"
                }, {
                    "internalType": "uint256[2]",
                    "name": "utxo",
                    "type": "uint256[2]"
                }, {
                    "internalType": "contract IERC20",
                    "name": "token",
                    "type": "address"
                }, {
                    "internalType": "uint256",
                    "name": "delta",
                    "type": "uint256"
                }, {
                    "components": [{
                        "internalType": "address",
                        "name": "owner",
                        "type": "address"
                    }, {
                        "components": [{ "internalType": "uint256[4]", "name": "data", "type": "uint256[4]" }],
                        "internalType": "struct OptimisticRollup.Message[2]",
                        "name": "message",
                        "type": "tuple[2]"
                    }], "internalType": "struct OptimisticRollup.TxExternalFields", "name": "ext", "type": "tuple"
                }, {
                    "components": [{ "internalType": "uint256[8]", "name": "data", "type": "uint256[8]" }],
                    "internalType": "struct OptimisticRollup.Proof",
                    "name": "proof",
                    "type": "tuple"
                }], "internalType": "struct OptimisticRollup.Tx", "name": "ctx", "type": "tuple"
            }, { "internalType": "uint256", "name": "new_root", "type": "uint256" }, {
                "internalType": "uint256",
                "name": "deposit_blocknumber",
                "type": "uint256"
            }], "internalType": "struct OptimisticRollup.BlockItem", "name": "item", "type": "tuple"
        }], "internalType": "struct OptimisticRollup.BlockItemNote", "name": "base", "type": "tuple"
    }],
    "name": "challengeTx",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [{
        "components": [{
            "internalType": "bytes32[8]",
            "name": "proof",
            "type": "bytes32[8]"
        }, {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
        }, {
            "components": [{
                "components": [{
                    "internalType": "uint256",
                    "name": "rootptr",
                    "type": "uint256"
                }, {
                    "internalType": "uint256[2]",
                    "name": "nullifier",
                    "type": "uint256[2]"
                }, {
                    "internalType": "uint256[2]",
                    "name": "utxo",
                    "type": "uint256[2]"
                }, {
                    "internalType": "contract IERC20",
                    "name": "token",
                    "type": "address"
                }, {
                    "internalType": "uint256",
                    "name": "delta",
                    "type": "uint256"
                }, {
                    "components": [{
                        "internalType": "address",
                        "name": "owner",
                        "type": "address"
                    }, {
                        "components": [{ "internalType": "uint256[4]", "name": "data", "type": "uint256[4]" }],
                        "internalType": "struct OptimisticRollup.Message[2]",
                        "name": "message",
                        "type": "tuple[2]"
                    }], "internalType": "struct OptimisticRollup.TxExternalFields", "name": "ext", "type": "tuple"
                }, {
                    "components": [{ "internalType": "uint256[8]", "name": "data", "type": "uint256[8]" }],
                    "internalType": "struct OptimisticRollup.Proof",
                    "name": "proof",
                    "type": "tuple"
                }], "internalType": "struct OptimisticRollup.Tx", "name": "ctx", "type": "tuple"
            }, { "internalType": "uint256", "name": "new_root", "type": "uint256" }, {
                "internalType": "uint256",
                "name": "deposit_blocknumber",
                "type": "uint256"
            }], "internalType": "struct OptimisticRollup.BlockItem", "name": "item", "type": "tuple"
        }], "internalType": "struct OptimisticRollup.BlockItemNote", "name": "cur", "type": "tuple"
    }, {
        "components": [{
            "internalType": "bytes32[8]",
            "name": "proof",
            "type": "bytes32[8]"
        }, {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
        }, {
            "components": [{
                "components": [{
                    "internalType": "uint256",
                    "name": "rootptr",
                    "type": "uint256"
                }, {
                    "internalType": "uint256[2]",
                    "name": "nullifier",
                    "type": "uint256[2]"
                }, {
                    "internalType": "uint256[2]",
                    "name": "utxo",
                    "type": "uint256[2]"
                }, {
                    "internalType": "contract IERC20",
                    "name": "token",
                    "type": "address"
                }, {
                    "internalType": "uint256",
                    "name": "delta",
                    "type": "uint256"
                }, {
                    "components": [{
                        "internalType": "address",
                        "name": "owner",
                        "type": "address"
                    }, {
                        "components": [{ "internalType": "uint256[4]", "name": "data", "type": "uint256[4]" }],
                        "internalType": "struct OptimisticRollup.Message[2]",
                        "name": "message",
                        "type": "tuple[2]"
                    }], "internalType": "struct OptimisticRollup.TxExternalFields", "name": "ext", "type": "tuple"
                }, {
                    "components": [{ "internalType": "uint256[8]", "name": "data", "type": "uint256[8]" }],
                    "internalType": "struct OptimisticRollup.Proof",
                    "name": "proof",
                    "type": "tuple"
                }], "internalType": "struct OptimisticRollup.Tx", "name": "ctx", "type": "tuple"
            }, { "internalType": "uint256", "name": "new_root", "type": "uint256" }, {
                "internalType": "uint256",
                "name": "deposit_blocknumber",
                "type": "uint256"
            }], "internalType": "struct OptimisticRollup.BlockItem", "name": "item", "type": "tuple"
        }], "internalType": "struct OptimisticRollup.BlockItemNote", "name": "prev", "type": "tuple"
    }, { "internalType": "uint256", "name": "right_root", "type": "uint256" }],
    "name": "challengeUTXOTreeUpdate",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [{ "internalType": "contract IERC20", "name": "token", "type": "address" }, {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
    }, { "internalType": "bytes32", "name": "txhash", "type": "bytes32" }],
    "name": "deposit",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "payable",
    "type": "function"
}, {
    "inputs": [{
        "components": [{
            "components": [{
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }, { "internalType": "contract IERC20", "name": "token", "type": "address" }, {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }], "internalType": "struct OptimisticRollup.UTXO", "name": "utxo", "type": "tuple"
        }, { "internalType": "uint256", "name": "blocknumber", "type": "uint256" }, {
            "internalType": "uint256",
            "name": "txhash",
            "type": "uint256"
        }], "internalType": "struct OptimisticRollup.PayNote", "name": "d", "type": "tuple"
    }],
    "name": "depositCancel",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [{ "internalType": "bytes32", "name": "x", "type": "bytes32" }],
    "name": "deposit_state",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [{ "internalType": "address", "name": "relayer", "type": "address" }],
    "name": "init",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "initialized",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [{
        "internalType": "uint256",
        "name": "protocol_version",
        "type": "uint256"
    }, {
        "components": [{
            "components": [{
                "internalType": "uint256",
                "name": "rootptr",
                "type": "uint256"
            }, {
                "internalType": "uint256[2]",
                "name": "nullifier",
                "type": "uint256[2]"
            }, {
                "internalType": "uint256[2]",
                "name": "utxo",
                "type": "uint256[2]"
            }, { "internalType": "contract IERC20", "name": "token", "type": "address" }, {
                "internalType": "uint256",
                "name": "delta",
                "type": "uint256"
            }, {
                "components": [{
                    "internalType": "address",
                    "name": "owner",
                    "type": "address"
                }, {
                    "components": [{ "internalType": "uint256[4]", "name": "data", "type": "uint256[4]" }],
                    "internalType": "struct OptimisticRollup.Message[2]",
                    "name": "message",
                    "type": "tuple[2]"
                }], "internalType": "struct OptimisticRollup.TxExternalFields", "name": "ext", "type": "tuple"
            }, {
                "components": [{ "internalType": "uint256[8]", "name": "data", "type": "uint256[8]" }],
                "internalType": "struct OptimisticRollup.Proof",
                "name": "proof",
                "type": "tuple"
            }], "internalType": "struct OptimisticRollup.Tx", "name": "ctx", "type": "tuple"
        }, { "internalType": "uint256", "name": "new_root", "type": "uint256" }, {
            "internalType": "uint256",
            "name": "deposit_blocknumber",
            "type": "uint256"
        }], "internalType": "struct OptimisticRollup.BlockItem[]", "name": "items", "type": "tuple[]"
    }, { "internalType": "uint256", "name": "rollup_cur_block_num", "type": "uint256" }, {
        "internalType": "uint256",
        "name": "blocknumber_expires",
        "type": "uint256"
    }],
    "name": "publishBlock",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "relayer",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [{ "internalType": "uint256", "name": "x", "type": "uint256" }],
    "name": "rollup_block",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "rollup_tx_num",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "tree_update_vk",
    "outputs": [{
        "components": [{ "internalType": "uint256[]", "name": "data", "type": "uint256[]" }],
        "internalType": "struct OptimisticRollup.VK",
        "name": "",
        "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "tx_vk",
    "outputs": [{
        "components": [{ "internalType": "uint256[]", "name": "data", "type": "uint256[]" }],
        "internalType": "struct OptimisticRollup.VK",
        "name": "",
        "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "version",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [{
        "components": [{
            "components": [{
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }, { "internalType": "contract IERC20", "name": "token", "type": "address" }, {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }], "internalType": "struct OptimisticRollup.UTXO", "name": "utxo", "type": "tuple"
        }, { "internalType": "uint256", "name": "blocknumber", "type": "uint256" }, {
            "internalType": "uint256",
            "name": "txhash",
            "type": "uint256"
        }], "internalType": "struct OptimisticRollup.PayNote", "name": "w", "type": "tuple"
    }],
    "name": "withdraw",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [{ "internalType": "bytes32", "name": "x", "type": "bytes32" }],
    "name": "withdraw_state",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
}];
