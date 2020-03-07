FROM node:12.10.0 As build

WORKDIR /home/node/app
COPY . .
RUN npm install && npm run build

FROM node:alpine

COPY --from=build /home/node/app /

ENV PORT = 3000
ENV RPC = 'http://127.0.0.1:8545'
ENV GAS_RPC = 'http://127.0.0.1:8545'
ENV CONTRACT_ADDRESS = ''
ENV GAS_CONTRACT = ''
ENV MNEMONIC = ''
ENV GAS_MNEMONIC = ''

#use --expose=[] to expose a port or a range of ports inside the container
EXPOSE 3000

CMD ["nest", "start"]
