import { test, expect } from "@playwright/test";

test.describe("API smoke", () => {
  test("GET /api/health returns healthy", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("healthy");
  });

  test("protected API without auth redirects to login", async ({ request }) => {
    const res = await request.post("/api/encashment", {
      data: { hotelId: "x", amount: 100 },
      maxRedirects: 0,
    });
    expect([307, 401, 403]).toContain(res.status());
  });

  test("login API rejects bad credentials", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: "bad@test.ru", password: "wrong" },
    });
    expect(res.status()).toBe(401);
  });

  test("login API accepts demo credentials", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: "demo@smena.ru", password: "demo123" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user?.email).toBe("demo@smena.ru");
    expect(body.user?.role).toBe("owner");
  });
});
