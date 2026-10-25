import { Injectable, BadRequestException } from '@nestjs/common';
import type { Scheme } from '@prisma/client';
import type { ISchemeCalculator } from './scheme-calculator.interface';
import { Scheme2019Calculator } from './scheme-2019.calculator';
import { Scheme2022Calculator } from './scheme-2022.calculator';
import { Scheme2024Calculator } from './scheme-2024.calculator';

/**
 * Returns the calculator that implements the rules for a given scheme name.
 * Used by MarksService to compute subject/student results in a scheme-aware way.
 */
@Injectable()
export class CalculatorFactory {
  private readonly calculators: Map<string, ISchemeCalculator>;

  constructor() {
    const calculators = [
      new Scheme2019Calculator(),
      new Scheme2022Calculator(),
      new Scheme2024Calculator(),
    ];

    this.calculators = new Map(calculators.map((c) => [c.schemeName.toUpperCase(), c]));
  }

  /**
   * Resolve a calculator by its registered scheme name.
   * @throws BadRequestException if the scheme isn't supported
   */
  get(schemeName: string): ISchemeCalculator {
    const calc = this.calculators.get(schemeName.toUpperCase());
    if (!calc) {
      throw new BadRequestException(`Calculator not available for scheme: ${schemeName}`);
    }
    return calc;
  }

  /** Convenience helper when starting from a Scheme record. */
  fromScheme(scheme: Pick<Scheme, 'name'>): ISchemeCalculator {
    return this.get(scheme.name);
  }

  /** Lists all supported scheme names (useful for admins / debugging). */
  listSupported(): string[] {
    return [...this.calculators.keys()];
  }
}
