import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { LoadersCSS } from 'ngx-loaders-css';
import { ElectronService } from "../../core/services";
import { toShortAddress } from "../home.component";


@Component({
  selector: 'app-deposit',
  templateUrl: './deposit.component.html',
  styleUrls: ['./deposit.component.scss']
})
export class DepositComponent {

  showSpinner = false;




  @Input()
  availableEthAmount: number;

  depositAmount: number;
  transactionHash: string;

  @Output()
  backClick = new EventEmitter<boolean>();

  bgColor = 'black';
  color = 'rgba(100, 100, 100, 0.5)';
  loader: LoadersCSS = 'pacman';

  constructor(  private electronService: ElectronService, private cd: ChangeDetectorRef) {
    //
  }

  onCancelClick() {
    this.backClick.emit(true);
  }

  onDepositClick() {
    this.electronService.ipcRenderer.send('deposit', this.depositAmount);
    this.showSpinner = true;
    this.cd.detectChanges();
    console.log('--1111--');

    this.electronService.ipcRenderer.on('deposit-hash', (event, std_out) => {
      console.log(std_out)
      this.showSpinner = false;
      this.cd.detectChanges();
    });
  }
}
