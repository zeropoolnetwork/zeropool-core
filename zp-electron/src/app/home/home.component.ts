import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ElectronService } from "../core/services";
import { BehaviorSubject } from "rxjs";
import { LoadersCSS } from 'ngx-loaders-css';


export function toShortAddress(address: string): string {
  return address.substring(0, 8) + '...' + address.substring(address.length - 8, address.length);
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  balanceRefreshingNow: boolean = true;
  balanceReady: boolean = false;

  showZpAddress = true;

  zpFullAddress = '';
  zpShortAddress = '';
  zpBalance = '0';
  ethBalance = '0';

  //zpBalance$ = new BehaviorSubject(0);
  ethFullAddress = '';
  ethShortAddress = '';

  bgColor = 'black';
  color = 'rgba(100, 100, 100, 0.5)';
  loader: LoadersCSS = 'pacman';

  constructor(private electronService: ElectronService, private cd: ChangeDetectorRef) {
    //
  }

  async ngOnInit(): Promise<void> {
    this.fetchAddresses();
    await this.refreshZpBalance();
    await this.refreshEthBalance();
    // Fetch address from electron
  }

  fetchAddresses() {
    this.electronService.ipcRenderer.send('get-zp-address');
    this.electronService.ipcRenderer.on('zp-address', (event, arg) => {
      this.zpFullAddress = arg;
      this.zpShortAddress = toShortAddress(arg);
      this.cd.detectChanges();
    });

    this.electronService.ipcRenderer.send('get-eth-address');
    this.electronService.ipcRenderer.on('eth-address', (event, arg) => {
      this.ethFullAddress = arg;
      this.ethShortAddress = toShortAddress(arg);
      this.cd.detectChanges();
    })
  }

  // stopRefresh(): void {
  //   console.log('stopRefresh');
  //   this.zpBalanceRefreshingNow = false;
  //   this.zpBalanceReady = true;
  //
  //   this.cd.detectChanges();
  // }
  activeForm: 'main' | 'deposit' | 'send' | 'withdraw' = 'main';

  refreshZpBalance(): Promise<void> {
    console.log('refreshZpBalance');

    // Fetch balance from electron
    this.electronService.ipcRenderer.send('get-zp-balance');
    this.balanceRefreshingNow = true;
    this.balanceReady = false;

    this.cd.detectChanges();

    return new Promise((resolve) => {
      // todo: get also an error
      this.electronService.ipcRenderer.on('zp-balance', (event, arg) => {
        // debugger
        this.zpBalance = (+arg).toFixed(5);
        console.log(this.zpBalance);
        // this.zpBalance$.next(arg);
        this.balanceRefreshingNow = false;
        this.balanceReady = true;

        console.log('done');
        this.cd.detectChanges();
        resolve();
      })
    });
  }

  refreshEthBalance(): Promise<void> {
    console.log('refreshEthBalance');

    // Fetch balance from electron
    this.electronService.ipcRenderer.send('get-eth-balance');
    this.balanceRefreshingNow = true;
    this.balanceReady = false;

    this.cd.detectChanges();

    return new Promise((resolve) => {
      // todo: get also an error
      this.electronService.ipcRenderer.on('eth-balance', (event, arg) => {
        // debugger
        this.ethBalance = arg.toFixed(5);

        // this.zpBalance$.next(arg);
        this.balanceRefreshingNow = false;
        this.balanceReady = true;

        console.log('done');
        this.cd.detectChanges();
        resolve();
      })
    });
  }

  showDepositFrom() {
    this.activeForm = 'deposit';
    this.cd.detectChanges();
  }

  showSendFrom() {
    this.activeForm = 'send';
    this.cd.detectChanges();
  }

  showWithdrawFrom() {
    this.activeForm = 'withdraw';
    this.cd.detectChanges();
  }

  switchAddress() {
    this.showZpAddress = !this.showZpAddress;
    if (this.showZpAddress) {
      this.refreshZpBalance();
    } else {
      this.refreshEthBalance();
    }
  }

  showMainForm() {
    console.log(4)
    this.activeForm = 'main';
    this.cd.detectChanges();
    console.log(5)
  }
}
