import { BetaAccessRequestRepository } from "./beta-access-request-repository";
import type { D1Database } from "@cloudflare/workers-types";
import { CustomerRepository } from "./customer-repository";
import { ServiceRepository } from "./service-repository";
import { ServiceRequestRepository } from "./service-request-repository";

export function createRepositories(database: D1Database) {
  return {
    betaAccessRequests: new BetaAccessRequestRepository(database),
    customers: new CustomerRepository(database),
    services: new ServiceRepository(database),
    serviceRequests: new ServiceRequestRepository(database),
  };
}

export {
  BetaAccessRequestRepository,
  CustomerRepository,
  ServiceRepository,
  ServiceRequestRepository,
};
