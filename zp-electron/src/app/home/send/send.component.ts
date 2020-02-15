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

  toAmount: number;
  toAddress: string;

  @Output()
  backClick = new EventEmitter<boolean>();

  isDone = false;
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
    this.electronService.ipcRenderer.send('transfer', this.toAmount, this.toAddress);
    this.showSpinner = true;
    this.cd.detectChanges();

    this.electronService.ipcRenderer.on('transfer-hash', (event, std_out) => {
      console.log(std_out)
      this.showSpinner = false;
      this.isDone = true;
      this.cd.detectChanges();
    });
  }
}
