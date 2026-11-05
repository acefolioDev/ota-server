import { pod } from "@elpod/core";
import { OtaController } from "./ota.controller";
import { OtaService } from "./ota.service";

export const ota = pod({
  name: "ota",
  controller: OtaController,
  providers: [OtaService],
});
