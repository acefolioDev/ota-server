import { pod } from "@elpod/core";
import { OtaAdminService } from "./ota-admin.service";
import { OtaAssetService } from "./ota-asset.service";
import { OtaManifestService } from "./ota-manifest.service";
import { OtaPublishService } from "./ota-publish.service";
import { OtaController } from "./ota.controller";
import { OtaRepo } from "./ota.repo";

export const ota = pod({
  name: "ota",
  prefix: "/api",
  controller: OtaController,
  providers: [OtaRepo, OtaManifestService, OtaPublishService, OtaAssetService, OtaAdminService],
});
