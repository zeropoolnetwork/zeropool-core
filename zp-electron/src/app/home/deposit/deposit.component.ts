import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { LoadersCSS } from 'ngx-loaders-css';


export function toShortAddress(address: string): string {
  return address.substring(0, 8) + '...' + address.substring(address.length - 8, address.length);
}

@Component({
  selector: 'app-deposit',
  templateUrl: './deposit.component.html',
  styleUrls: ['./deposit.component.scss']
})
export class DepositComponent {

  @Input()
  ethAmount: number;

  @Output()
  backClick = new EventEmitter<boolean>();

  color = 'rgba(100, 100, 100, 0.5)';
  loader: LoadersCSS = 'pacman';

  constructor() {
    //
  }

  onCancelClick() {
    this.backClick.emit(true);
  }

  onDepositClick() {
    this.backClick.emit(true);
    // Emit amount to deposit ???
  }
}
