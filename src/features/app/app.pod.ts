import { pod } from "@elpod/core";
import { AppController } from "./app.controller";

export const app = pod({
  name: "app",
  prefix: "/",
  controller: AppController,
});
