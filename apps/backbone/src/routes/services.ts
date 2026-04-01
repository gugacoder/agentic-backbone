import {
  createService,
  updateService,
  deleteService,
  assignServiceToAgent,
  listAllServicesGlobally,
} from "../services/manager.js";
import { loadAgentServices } from "../services/loader.js";
import { createResourceCrudRoutes } from "./resource-crud.js";

export const serviceRoutes = createResourceCrudRoutes("services", {
  list: loadAgentServices,
  listGlobal: listAllServicesGlobally,
  create: createService,
  update: updateService,
  delete: deleteService,
  assign: assignServiceToAgent,
});
