import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { LoadersCSS } from 'ngx-loaders-css';
import { ElectronService } from "../../core/services";


@Component({
  selector: 'app-send',
  templateUrl: './send.component.html',
  styleUrls: ['./send.component.scss']
})
export class SendComponent {

  @Input()
  zpEthAmount: number;

  @Output()
  backClick = new EventEmitter<boolean>();

  showSpinner = false;
  bgColor = 'black';
  color = 'rgba(100, 100, 100, 0.5)';
  loader: LoadersCSS = 'pacman';

  constructor(private electronService: ElectronService, private cd: ChangeDetectorRef) {
  }

  onCancelClick() {
    this.backClick.emit(true);
  }

  onSendClick() {
    this.showSpinner = false;
    this.cd.detectChanges();

    // Emit amount to deposit ???
  }
}
