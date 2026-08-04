import {
  ActivationLimitError,
  DuplicateActivationError,
  InvalidLicenseTransitionError,
} from "./errors";
import type { LicenseState } from "../db/types";

const allowedTransitions: Record<LicenseState, readonly LicenseState[]> = {
  pending: ["active", "expired", "revoked"],
  active: ["expired", "revoked"],
  expired: [],
  revoked: [],
};

export function assertLicenseTransition(from: LicenseState, to: LicenseState): void {
  if (from === to || allowedTransitions[from].includes(to)) {
    return;
  }

  throw new InvalidLicenseTransitionError(`Cannot transition license from ${from} to ${to}.`);
}

export function assertActivationCapacity(activeCount: number, activationLimit: number): void {
  if (activeCount >= activationLimit) {
    throw new ActivationLimitError("License activation limit has been reached.");
  }
}

export function assertActivationIsUnique(existingActivationId: string | null): void {
  if (existingActivationId) {
    throw new DuplicateActivationError("Device is already activated for this license.");
  }
}
