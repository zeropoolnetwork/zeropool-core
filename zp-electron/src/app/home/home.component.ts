import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ElectronService } from "../core/services";
import { BehaviorSubject } from "rxjs";


export function toShortAddress(address: string): string {
  return address.substring(0, 8) + '...' + address.substring(address.length - 8, address.length);
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  zpFullAddress = '';
  zpShortAddress = '';
  zpBalance = '0';
  //zpBalance$ = new BehaviorSubject(0);
  constructor(private electronService: ElectronService, private cd: ChangeDetectorRef) {

  }

  ngOnInit(): void {
    this.fetchAddress();
    // this.refreshBalance();

    // Fetch address from electron
  }

  fetchAddress() {
    this.electronService.ipcRenderer.send('get-zp-address');
    this.electronService.ipcRenderer.on('zp-address', (event, arg) => {
      this.zpFullAddress = arg;
      this.zpShortAddress = toShortAddress(arg);
      this.cd.detectChanges();
    })
  }

  refreshBalance() {
    // Fetch balance from electron
    this.electronService.ipcRenderer.send('get-balance');
    this.electronService.ipcRenderer.on('balance', (event, arg) => {
      // debugger
      this.zpBalance = (+arg).toFixed(5);
      // this.zpBalance$.next(arg);
      console.log('done');
      this.cd.detectChanges();
    })
  }

  showDepositFrom() {

  }

  showSendFrom() {

  }

  showWithdrawFrom() {

  }
}
