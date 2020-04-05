<!--
<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</p>
-->

## ZeroPool Relayer

## Installation

```bash
$ npm install
```

## Build the app
To build relayer run `npm run build` or `nest build`

### ENV
You can specify application environment in config.yml (directory: config) or via ENV
```bash
ENV PORT = 3000                       // Relayer's application port
ENV RPC = 'http://127.0.0.1:8545'     // Main contract RPC endpont
ENV GAS_RPC = 'http://127.0.0.1:8545' // Gas contract RPC endpont
ENV CONTRACT_ADDRESS = ''             // Main Ethereum ZeroPool contract address
ENV GAS_CONTRACT = ''                 // ZeroPool Gas contract address
ENV MNEMONIC = ''                     // Secret phrase for Main contract calls (publish block)
ENV GAS_MNEMONIC = ''                 // Secret phrase for Gas contract calls (publish block)
```

## Running the app

```bash
# development
$ npm run start

# debug mode
$ npm run start:debug
```

## Docker
```
docker build relayer .
docker run -d -p 3000:3000 relayer
```

## Swagger
Swagger is available at `/docs` 

## License
[GNU GENERAL PUBLIC LICENSE]()
