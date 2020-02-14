import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as url from 'url';

import * as ZeroPoolNetwork from '../lib/zero-pool-network';
import * as ethUtils from '../lib/ethereum/ethereum';
// import { DomainEthereum, HdWallet, Keys } from "@buttonwallet/blockchain-ts-wallet-core";

const config = {
  contract: '0xBC3b9990CE2F72a97A82913894392CadA8d9558B',
  mnemonic: 'session oppose search lunch cave enact quote wire debate knee noble drama exit way scene',
  secret: '0xf4c3be1dfb4f1f7a6ac4f65167aeccacb1d2e820fadfb386f536c65a0786ffff',
  value: 0.1,
  asset: 'ETH',
  rpc: 'https://rinkeby.infura.io/v3/716d959325724d16a970e53a6bc28dc8',
  relayer: 'http://134.209.172.229:3000'
}

const zp = new ZeroPoolNetwork(
  config.contract,
  config.secret,
  config.mnemonic,
  config.rpc
);

console.log('Hi:', zp);
console.log(`ZeroPool contract address = ${config.contract}`);
// console.log(`Your eth address = ${this.ethAddress}`);
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
    width: size.width,
    height: size.height,
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
  ipc.on('get-balance', async (event, arg) => {
    const balancePerAsset = await zp.getBalance();

    let balance = 0;
    if (balancePerAsset['0x0']){
      balance = ethUtils.fw(balancePerAsset['0x0']);
    }

    win.webContents.send('balance', balance);
  });

  ipc.on('get-zp-address', async (event, arg) => {
    //const balance = await zp.getBalance()
    const zpAddress = `${"0x" + zp.zpKeyPair.publicKey.toString(16)}`;
    win.webContents.send('zp-address', zpAddress);
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
