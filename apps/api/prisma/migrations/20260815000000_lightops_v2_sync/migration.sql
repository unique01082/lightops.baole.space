CREATE TABLE "ToolPreset" (
    "userSub" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ToolPreset_pkey" PRIMARY KEY ("userSub", "id")
);

CREATE TABLE "UserSetting" (
    "userSub" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("userSub", "key")
);

CREATE TABLE "SyncMutation" (
    "userSub" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncMutation_pkey" PRIMARY KEY ("userSub", "deviceId", "clientMutationId")
);

CREATE TABLE "SyncChange" (
    "cursor" BIGSERIAL NOT NULL,
    "userSub" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncChange_pkey" PRIMARY KEY ("cursor")
);

CREATE INDEX "ToolPreset_userSub_updatedAt_idx" ON "ToolPreset"("userSub", "updatedAt");
CREATE INDEX "UserSetting_userSub_updatedAt_idx" ON "UserSetting"("userSub", "updatedAt");
CREATE INDEX "SyncChange_userSub_cursor_idx" ON "SyncChange"("userSub", "cursor");
