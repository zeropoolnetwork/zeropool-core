import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ElectronService } from "../core/services";
import { BehaviorSubject } from "rxjs";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  zpAddress = '';
  zpBalance = 0;
  //zpBalance$ = new BehaviorSubject(0);
  constructor(private electronService: ElectronService, private cd: ChangeDetectorRef) { }

  ngOnInit(): void {

    // Fetch address from electron
    this.electronService.ipcRenderer.send('get-zp-address');
    this.electronService.ipcRenderer.on('zp-address', (event, arg) => {
      this.zpAddress = arg;
      this.cd.detectChanges();
    })
  }

  getBalance() {

    // Fetch balance from electron
    this.electronService.ipcRenderer.send('get-balance');
    this.electronService.ipcRenderer.on('balance', (event, arg) => {
      // debugger
      this.zpBalance = arg;
      // this.zpBalance$.next(arg);
      console.log('done');
      this.cd.detectChanges();
    })
  }
}
