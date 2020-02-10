import { ApiProperty } from '@nestjs/swagger';

export class TxDto {
  @ApiProperty()
  hex: string;
}
