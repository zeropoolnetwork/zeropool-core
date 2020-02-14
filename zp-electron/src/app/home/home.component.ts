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

  zpBalanceRefreshingNow: boolean = true;
  zpBalanceReady: boolean = false;

  showZpAddress = true;

  zpFullAddress = '';
  zpShortAddress = '';
  zpBalance = '0';

  //zpBalance$ = new BehaviorSubject(0);
  ethFullAddress = '';
  ethShortAddress = '';

  bgColor = 'black';
  color = 'rgba(100, 100, 100, 0.5)';
  loader: LoadersCSS = 'pacman';

  constructor(private electronService: ElectronService, private cd: ChangeDetectorRef) {
    //
  }

  ngOnInit(): void {
    this.fetchAddresses();
    // this.refreshZpBalance();

    // Fetch address from electron
  }

  fetchAddresses() {
    this.electronService.ipcRenderer.send('get-zp-address');
    this.electronService.ipcRenderer.on('zp-address', (event, arg) => {
      this.zpFullAddress = arg;
      this.zpShortAddress = toShortAddress(arg);
      this.cd.detectChanges();
    })

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
  activeForm: 'main' | 'deposit' | 'send' |'withdraw' = 'main';

  refreshZpBalance(): void {
    console.log('refreshZpBalance');

    // Fetch balance from electron
    this.electronService.ipcRenderer.send('get-balance');
    this.zpBalanceRefreshingNow = true;
    this.zpBalanceReady = false;

    this.cd.detectChanges();

    this.electronService.ipcRenderer.on('balance', (event, arg) => {
      // debugger
      this.zpBalance = (+arg).toFixed(5);

      // this.zpBalance$.next(arg);
      this.zpBalanceRefreshingNow = false;
      this.zpBalanceReady = true;

      console.log('done');
      this.cd.detectChanges();
    })
  }

  showDepositFrom() {
    this.activeForm = 'deposit';
  }

  showSendFrom() {
    this.activeForm = 'send';
  }

  showWithdrawFrom() {
    this.activeForm = 'withdraw';
  }

  switchAddress() {
    this.showZpAddress = !this.showZpAddress;
  }

  showMainForm() {
    this.activeForm = 'main';
  }
}
