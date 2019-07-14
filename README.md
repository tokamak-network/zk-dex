# ZK-DEX PoC

## Directory

- Front
- Circuit
- SmartContract

## Documents
- [Architecture Presentation](https://docs.google.com/presentation/d/1j7oluYl4r9W-ybOwrfmAuU8s7QM74hXAotucHQ2AMNw/edit?usp=sharing)
- [Architecture Memo](https://www.notion.so/onther/zk-dex-48afbac555c34255a2c567bf0a8490dd)

## Requirement
- docker
- ganache-cli

## Usage
	1. npm install
	2. ganache-cli (background running)
	3. npm run start:zokrates
	4. npm run initialize:zokrates // all circuit compile, setup and export verifiers to contracts
	5. npx truffle compile
        6. npx truffle migrate --reset
