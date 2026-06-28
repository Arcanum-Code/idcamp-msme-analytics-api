import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
  resetDatabase,
} from "../test_utils";

describe("Shop API", () => {
  let authHeaders: Record<string, string>;
  let user: any;
  let createdShopId: string;

  beforeAll(async () => {
    await resetDatabase();
    const authData = await createAuthenticatedUser({
      email: "shop-test@example.com",
    });
    user = authData.user;
    authHeaders = authData.authHeaders;

    // Create 'shop_management' feature and assign to user's role
    const feature = await prisma.feature.create({
      data: { name: "shop_management" },
    });

    await prisma.roleFeature.create({
      data: {
        roleId: user.roleId,
        featureId: feature.id,
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("POST /api/shops - should create a new shop", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/shops", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          name: "Test Shop",
          description: "A test shop description",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as any;
    expect(data.data.name).toBe("Test Shop");
    expect(data.data.ownerId).toBe(user.id);
    createdShopId = data.data.id;
  });

  it("GET /api/shops - should retrieve list of shops", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/shops", {
        method: "GET",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].name).toBe("Test Shop");
  });

  it("GET /api/shops/:id - should get a single shop", async () => {
    const response = await app.handle(
      new Request(`http://localhost/api/shops/${createdShopId}`, {
        method: "GET",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(data.data.id).toBe(createdShopId);
  });

  it("PATCH /api/shops/:id - should update the shop", async () => {
    const response = await app.handle(
      new Request(`http://localhost/api/shops/${createdShopId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated Test Shop",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(data.data.name).toBe("Updated Test Shop");
  });

  it("DELETE /api/shops/:id - should delete the shop", async () => {
    const response = await app.handle(
      new Request(`http://localhost/api/shops/${createdShopId}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);

    // Verify it is gone
    const getResponse = await app.handle(
      new Request(`http://localhost/api/shops/${createdShopId}`, {
        method: "GET",
        headers: authHeaders,
      }),
    );
    expect(getResponse.status).toBe(404);
  });

  describe("GET /api/shops/me", () => {
    beforeEach(async () => {
      await resetDatabase();
      await createTestRoleWithPermissions("TestUser", []);
    });

    it("should return 401 if user is not logged in", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/shops/me", {
          headers: {
            "x-forwarded-for": randomIp(),
          },
        }),
      );
      expect(response.status).toBe(401);
    });

    it("should return 200 with null data if user has no shop", async () => {
      const { token: accessToken } = await createAuthenticatedUser({
        id: "test-no-shop",
        email: "test-no-shop@example.com",
      });
      const response = await app.handle(
        new Request("http://localhost/api/shops/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-forwarded-for": randomIp(),
          },
        }),
      );
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.data).toBeNull();
    });

    it("should return 200 with shop data if user has a shop", async () => {
      const { user, token: accessToken } = await createAuthenticatedUser({
        id: "test-has-shop",
        email: "test-has-shop@example.com",
      });

      // Create a shop for the user
      await prisma.shop.create({
        data: {
          name: "My Awesome Shop",
          description: "This is my shop",
          ownerId: user.id,
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/shops/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-forwarded-for": randomIp(),
          },
        }),
      );
      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.data.name).toBe("My Awesome Shop");
      expect(data.data.ownerId).toBe(user.id);
    });
  });
});
