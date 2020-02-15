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

  @Input()
  availableEthAmount: number;

  depositAmount: number;
  transactionHash: string;

  @Output()
  backClick = new EventEmitter<boolean>();

  color = 'rgba(100, 100, 100, 0.5)';
  loader: LoadersCSS = 'pacman';

  constructor(  private electronService: ElectronService) {
    //
  }

  onCancelClick() {
    this.backClick.emit(true);
  }

  onDepositClick() {
    this.electronService.ipcRenderer.send('deposit', this.depositAmount);
    this.electronService.ipcRenderer.on('deposit-hash', (event, std_out) => {
      console.log(std_out);
      this.backClick.emit(true);
    });
    // this.backClick.emit(true);
    // Emit amount to deposit ???
  }
}
