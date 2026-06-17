import { test, expect } from "@playwright/test";
import { openDashboard, loginViaForm } from "./helpers";

test.describe("Auth UI", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Смена" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
  });

  test("demo login via form redirects to dashboard", async ({ page }) => {
    await loginViaForm(page);
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("unauthenticated user redirected from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Authenticated navigation", () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
  });

  const routes = [
    { path: "/dashboard", title: /Dashboard/i },
    { path: "/grid", title: /Шахматка/i },
    { path: "/guests", title: /База гостей/i },
    { path: "/rooms", title: /Номерной фонд/i },
    { path: "/reports", title: /Отчёты/i },
    { path: "/channels", title: /Менеджер каналов/i },
    { path: "/organizations", title: /Организации/i },
    { path: "/schedule", title: /График работы/i },
    { path: "/settings", title: /Настройки/i },
  ];

  for (const { path, title } of routes) {
    test(`page ${path} loads`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace("/", "\\/")));
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe("Guests", () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
    await page.goto("/guests");
    await expect(page.getByText(/База гостей/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("guest list shows seeded guests", async ({ page }) => {
    await expect(page.getByText(/Петров|Иванов|Schmidt/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("select guest opens profile panel", async ({ page }) => {
    const guestBtn = page.getByRole("button").filter({ hasText: /Петров|Иванов/i }).first();
    await guestBtn.click();
    await expect(page.getByRole("button", { name: /Редактировать/i })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Security", () => {
  test("encashment API requires auth session", async ({ request }) => {
    const res = await request.post("/api/encashment", {
      data: { hotelId: "fake", amount: 1000 },
      maxRedirects: 0,
    });
    expect([307, 401, 403]).toContain(res.status());
  });

  test("authenticated bootstrap returns data", async ({ page }) => {
    await openDashboard(page);
    const res = await page.request.get("/api/bootstrap");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.hotels?.length).toBeGreaterThan(0);
    expect(body.guests?.length).toBeGreaterThan(0);
  });
});
