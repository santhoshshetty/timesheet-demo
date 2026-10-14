import { randomInt } from 'node:crypto';
import { ChargeCode } from '../../domain/project/ChargeCode';
import type { ChargeCodeGenerator } from '../../domain/project/ports';

const CODE_SPACE = 100_000_000;

export class RandomChargeCodeGenerator implements ChargeCodeGenerator {
  next(): ChargeCode {
    return ChargeCode.of(String(randomInt(0, CODE_SPACE)).padStart(8, '0'));
  }
}
