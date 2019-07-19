const address = '0x154c5e3762fbb57427d6b03e7302bda04c497226'
const ABI = 
[
	{
		"constant": true,
		"inputs": [],
		"name": "n",
		"outputs": [
			{
				"name": "",
				"type": "uint256"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": false,
		"inputs": [
			{
				"name": "n",
				"type": "uint256"
			}
		],
		"name": "setN",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"name": "n",
				"type": "uint256"
			}
		],
		"name": "StorageSet",
		"type": "event"
	}
]

export { address, ABI }