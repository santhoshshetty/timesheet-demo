const PATTERN = /^[0-9]{8}$/;

/** System-generated 8-digit project code; always handled as text so leading zeros survive. */
export class ChargeCode {
  private constructor(private readonly value: string) {}

  static isValid(value: string): boolean {
    return PATTERN.test(value);
  }

  static of(value: string): ChargeCode {
    if (!ChargeCode.isValid(value)) {
      throw new RangeError(`Charge code must be exactly 8 digits: ${value}`);
    }
    return new ChargeCode(value);
  }

  equals(other: ChargeCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
