import {
  createSkill,
  updateSkill,
  deleteSkill,
  assignSkillToAgent,
  listAllSkillsGlobally,
} from "../skills/manager.js";
import { loadAllSkills } from "../skills/loader.js";
import { createResourceCrudRoutes } from "./resource-crud.js";

export const skillRoutes = createResourceCrudRoutes("skills", {
  list: loadAllSkills,
  listGlobal: listAllSkillsGlobally,
  create: createSkill,
  update: updateSkill,
  delete: deleteSkill,
  assign: assignSkillToAgent,
});
