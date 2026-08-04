export class LicensingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicensingError";
  }
}

export class InvalidLicenseTransitionError extends LicensingError {}
export class ActivationLimitError extends LicensingError {}
export class LicenseNotActiveError extends LicensingError {}
export class DuplicateActivationError extends LicensingError {}
