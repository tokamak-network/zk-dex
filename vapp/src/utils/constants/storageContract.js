const address = '0x3dc2cd8f2e345951508427872d8ac9f635fbe0ec'
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