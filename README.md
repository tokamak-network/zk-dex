# ZK-DEX PoC

## Directory

- Front
- Circuit
- SmartContract

## Documents
- [Presentation](https://docs.google.com/presentation/d/1b6yD4iV-vS_KyK27CG9ImMRdTypm9mtIbd5m3a_MNeU/edit?usp=sharing)
- [Demo](https://youtu.be/QvKaqMH_5lk)

## Requirement
- docker
- ganache-cli


## Basic Usage
```bash
# 1. install node packages.
$ npm install

# 2. run ganache-cli in another terminal.
$ ganache-cli -e 10000

# 3. run zokrates docker container and initialize it.
$ npm run docker

# 3-1. (optional) if container is already running, restart it.
$ npm run docker:restart && npm run docker:init

# 4. run truffle commands (e.g., test).
$ npx truffle test ./test/ZkDex.test.js
```

## Vue App Instalation (macOS)
```bash
# install socat
$ brew install socat

# TODO: what need to do before run vue app
$ cd vapp && npm install && cd ..
```

## Run Vue App
```bash
# expose docker api to TCP to use docker in vue app
$ socat TCP-LISTEN:3000,reuseaddr,fork UNIX-CONNECT:/var/run/docker.sock &

# TODO: how to run vue app
$ cd vapp && npm run serve
```