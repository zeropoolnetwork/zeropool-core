import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeRoutingModule } from './home-routing.module';

import { HomeComponent } from './home.component';
import { SharedModule } from '../shared/shared.module';
import { NgxLoadersCssModule } from "ngx-loaders-css";
import { DepositComponent } from "./deposit/deposit.component";

@NgModule({
  declarations: [HomeComponent, DepositComponent],
  imports: [CommonModule, SharedModule, HomeRoutingModule, NgxLoadersCssModule]
})
export class HomeModule {}
