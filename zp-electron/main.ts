import { app, BrowserWindow, screen } from 'electron';
const axios = require('axios').default;
import * as path from 'path';
import * as url from 'url';

import * as ZeroPoolNetwork from '../lib/zero-pool-network';
import * as ethUtils from '../lib/ethereum/ethereum';
import { DomainEthereum, HdWallet } from "@buttonwallet/blockchain-ts-wallet-core";

// TODO: parse config if needed
// import { cosmiconfigSync } from "cosmiconfig";
// function loadConfig(pathToConfig?: string): Promise<any> {
//   const explorer = cosmiconfigSync('alice');
//   const result = pathToConfig
//     ? explorer.load(pathToConfig)
//     : explorer.search();
//
//   if (result) {
//     const { config, filepath } = result;
//     return config;
//   }
// }
// loadConfig();


///////
const util = require('util');
const exec = util.promisify(require('child_process').exec);


async function deposit(amount) {
  const { stdout, stderr } = await exec(
    `./../zp-cli/bin/run deposit --value=${amount} --config=./../zp-cli/alice.config.js`
  );
  if (stderr) {
    return stderr;
  }
  return stdout;
}

async function transfer(to, amount) {
  const { stdout, stderr } = await exec(
    `./../zp-cli/bin/run transfer --value=${amount} --to=${to} --config=./../zp-cli/alice.config.js`
  );
  if (stderr) {
    return stderr;
  }
  return stdout;
}

async function withdraw() {
  const { stdout, stderr } = await exec(
    `./../zp-cli/bin/run withdraw --config=./../zp-cli/alice.config.js`
  );
  if (stderr) {
    return stderr;
  }
  return stdout;
}

//////

const ETH_ASSET_ADDRESS = '0x0000000000000000000000000000000000000000';


const config = {
  contract: '0xF0c255b0881acDc7f1C855A823D900F3A78fA1c2',
  mnemonic: 'session oppose search lunch cave enact quote wire debate knee noble drama exit way scene',
  ethSecret: '0x4ba3ab0d4ac147ae88674bd03529f311fc54e805200d7c15b00f887e75c4c18e',
  asset: 'ETH',
  rpc: 'https://rinkeby.infura.io/v3/716d959325724d16a970e53a6bc28dc8',
  relayer: 'http://134.209.172.229:3000'
};

const zp = new ZeroPoolNetwork(
  config.contract,
  config.ethSecret,
  config.mnemonic,
  config.rpc
);

let ethAddress = '';

// Convert ethAddress to private key
if (HdWallet.isValidMnemonic(config.ethSecret)) {
  const hdWallet = new HdWallet(config.ethSecret, '');
  const wallet = hdWallet.generateKeyPair(DomainEthereum.Instance(), 0);
  config.ethSecret = wallet.privateKey;
  ethAddress = wallet.address;
} else {
  ethAddress = ethUtils.getEthereumAddress(config.ethSecret);
}

console.log(`ZeroPool contract address = ${config.contract}`);
console.log(`Your eth address = ${ethAddress}`);
console.log(`Your zp address = ${"0x" + zp.zpKeyPair.publicKey.toString(16)}`);


let win: BrowserWindow = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createWindow(): BrowserWindow {

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    // width: size.width,
    // height: size.height,
    width: 950,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: (serve) ? true : false,
    },
  });

  if (serve) {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
    win.loadURL('http://localhost:4200');
  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  if (serve) {
    win.webContents.openDevTools();
  }

  const ipc = require('electron').ipcMain;
  ipc.on('get-zp-balance', async (event, arg) => {

    const balancePerAsset = await zp.getBalance();
    let balance = 0;
    if (balancePerAsset['0x0']) {
      balance = ethUtils.fw(balancePerAsset['0x0']);
    }
    win.webContents.send('zp-balance', balance);
  });

  ipc.on('get-eth-balance', async (event, arg) => {
    const balanceInWei = await zp.ZeroPool.web3Ethereum.getBalance(ethAddress);
    const balance = ethUtils.fw(balanceInWei);
    win.webContents.send('eth-balance', balance);
  });

  ipc.on('get-zp-address', async (event, arg) => {
    //const balance = await zp.getBalance()
    const zpAddress = `${"0x" + zp.zpKeyPair.publicKey.toString(16)}`;
    win.webContents.send('zp-address', zpAddress);
  });

  ipc.on('get-eth-address', async (event, arg) => {
    //const balance = await zp.getBalance()
    win.webContents.send('eth-address', ethAddress);
  });

  ipc.on('deposit', async (event, amount) => {
    try {
      const std_out = await deposit(amount);
      win.webContents.send('deposit-hash', std_out);
    } catch (e) {
      console.log(e)
    }
  });

  ipc.on('transfer', async (event, amount, address) => {
    try {
      const std_out = await transfer(address, amount);
      win.webContents.send('transfer-hash', std_out);
    } catch (e) {
      console.log(e)
    }
  });

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  return win;
}

try {

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow);

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

} catch (e) {
  // Catch Error
  // throw e;
}
