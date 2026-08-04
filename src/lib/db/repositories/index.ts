import { BetaAccessRequestRepository } from "./beta-access-request-repository";
import type { D1Database } from "@cloudflare/workers-types";
import { CustomerRepository } from "./customer-repository";
import { ServiceRepository } from "./service-repository";
import { ServiceRequestRepository } from "./service-request-repository";
import { DeviceRepository } from "./device-repository";
import { LicenseRepository } from "./license-repository";
import { SessionRepository } from "./session-repository";
import { UserRepository } from "./user-repository";

export function createRepositories(database: D1Database) {
  return {
    betaAccessRequests: new BetaAccessRequestRepository(database),
    customers: new CustomerRepository(database),
    devices: new DeviceRepository(database),
    licenses: new LicenseRepository(database),
    sessions: new SessionRepository(database),
    services: new ServiceRepository(database),
    serviceRequests: new ServiceRequestRepository(database),
    users: new UserRepository(database),
  };
}

export {
  BetaAccessRequestRepository,
  CustomerRepository,
  DeviceRepository,
  LicenseRepository,
  SessionRepository,
  ServiceRepository,
  ServiceRequestRepository,
  UserRepository,
};
