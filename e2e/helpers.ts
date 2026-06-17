import { test, expect, type Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@smena.ru";
export const DEMO_PASSWORD = "demo123";

/** Вход через API — cookie сохраняется в контексте page */
export async function loginViaApi(page: Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.user?.email).toBe(DEMO_EMAIL);
}

export async function openDashboard(page: Page) {
  await loginViaApi(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/** Вход через форму (отдельный UI-тест) */
export async function loginViaForm(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}
