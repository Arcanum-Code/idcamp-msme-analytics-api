import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  randomIp,
  createTestUpload,
  createTestRoleWithPermissions,
} from "../test_utils";
import { UploadStatus } from "@generated/prisma";

const GET = (uploadId: string, headers: Record<string, string>) =>
  app.handle(
    new Request(`http://localhost/api/uploads/${uploadId}/status`, {
      method: "GET",
      headers: {
        "x-forwarded-for": randomIp(),
        ...headers,
      },
    }),
  );

describe("GET /api/uploads/:uploadId/status", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "uploads_management", action: "read" },
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should return 404 if upload does not exist", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    const res = await GET("invalid-id", authHeaders);
    expect(res.status).toBe(404);
  });

  it("should return 404 if upload belongs to a different shop", async () => {
    const user1 = await createAuthenticatedUser();
    const user2 = await createAuthenticatedUser({
      id: "test-user-id-2",
      email: "user2@test.com",
    });

    // Create upload for user1
    const { upload } = await createTestUpload(user1.user.id, {
      status: UploadStatus.READY,
    });

    // Request as user2
    const res = await GET(upload.id, user2.authHeaders);
    expect(res.status).toBe(404);
  });

  it("should return 200 and status data if successful", async () => {
    const { user, authHeaders } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, {
      status: UploadStatus.READY,
    });

    // Update fields not customizable by createTestUpload overrides
    await prisma.rawUpload.update({
      where: { id: upload.id },
      data: {
        filename: "test.csv",
        rowCount: 10,
      },
    });

    const res = await GET(upload.id, authHeaders);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      error: boolean;
      data: {
        uploadId: string;
        status: string;
        filename: string;
        rowCount: number;
        uploadedAt: string;
        error?: unknown;
      };
    };

    console.log(body);
    expect(body.error).toBe(false);
    expect(body.data.uploadId).toBe(upload.id);
    expect(body.data.status).toBe("READY");
    expect(body.data.filename).toBe("test.csv");
    expect(body.data.rowCount).toBe(10);
    expect(body.data.uploadedAt).toBeDefined();
    expect(body.data.error).toBeUndefined();
  });
});
