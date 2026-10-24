import { expect, test, type Locator, type Page } from "@playwright/test";

const password = "test-password-123";

// Waits for the server action, so a hard navigation right after does not race it.
async function addToCart(page: Page, card: Locator) {
  const saved = page.waitForResponse((r) => r.request().method() === "POST");
  await card.getByTestId("add-to-cart").click();
  await saved;
  await expect(card.getByTestId("qty-control")).toBeVisible();
}

const isAdminPage = (url: URL) => url.pathname.startsWith("/ru/admin");

// admin@koshava.test must be listed in ADMIN_EMAILS of the running app.
async function signInAdmin(page: Page) {
  await page.goto("/ru/register?next=/ru/admin");
  await page.getByLabel("Эл. почта").fill("admin@koshava.test");
  await page.getByLabel("Пароль").fill(password);
  await page.getByTestId("auth-submit").click();
  const taken = page.getByTestId("auth-error");
  await Promise.race([page.waitForURL(isAdminPage), taken.waitFor()]);
  if (await taken.isVisible()) {
    await page.goto("/ru/login?next=/ru/admin");
    await page.getByLabel("Эл. почта").fill("admin@koshava.test");
    await page.getByLabel("Пароль").fill(password);
    await page.getByTestId("auth-submit").click();
  }
}

test("guest cart survives sign-up and an order is placed and processed", async ({ page }, info) => {
  const email = `buyer-${Date.now()}-${info.project.name}@koshava.test`;

  // Guest adds the most expensive products until the minimum order is reached.
  await page.goto("/ru/catalog?sort=priceDesc");
  const cards = page.getByTestId("product-card");
  await expect(cards.first()).toBeVisible();
  for (let i = 0; i < 3; i++) await addToCart(page, cards.nth(i));
  const favorited = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByTestId("favorite").first().click();
  await favorited;

  await page.goto("/ru/cart");
  await expect(page.getByTestId("cart-line")).toHaveCount(3);
  await expect(page.getByTestId("min-order")).toHaveCount(0);
  await page.getByTestId("checkout-link").click();

  // Checkout requires an account; the guest cart moves into it.
  await page.waitForURL(/\/login\?next=/);
  await page.getByRole("link", { name: "Зарегистрироваться" }).click();
  await page.getByLabel("Имя").fill("Тест Тестов");
  await page.getByLabel("Эл. почта").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/ru\/checkout/);

  await page.getByLabel("Имя и фамилия").fill("Тест Тестов");
  await page.getByLabel("Телефон").fill("+381 64 123 4567");
  await page.getByLabel("Улица").fill("Knez Mihailova");
  await page.getByLabel("Дом", { exact: true }).fill("12");
  await page.getByLabel("Квартира").fill("5");
  await page.getByTestId("place-order").click();

  await page.waitForURL(/\/ru\/orders\/KS-\d+\?placed=1/);
  await expect(page.getByTestId("order-thanks")).toBeVisible();
  const number = page.url().match(/KS-\d+/)![0];

  // The cart is empty, favorites and the saved address remain.
  await page.goto("/ru/cart");
  await expect(page.getByText("Корзина пуста")).toBeVisible();
  await page.goto("/ru/favorites");
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await page.goto("/ru/account");
  await expect(page.getByText(number)).toBeVisible();
  await expect(page.getByText("Knez Mihailova 12")).toBeVisible();
  await page.getByTestId("logout").click();

  // An admin confirms the order.
  await signInAdmin(page);
  await page.waitForURL(isAdminPage);
  await page.getByRole("link", { name: number }).click();
  await page.getByTestId("status-confirmed").click();
  await expect(page.getByTestId("order-status").first()).toHaveText("Подтверждён");
});

test("minimum order blocks checkout and language switch keeps the page", async ({ page }) => {
  await page.goto("/sr/catalog?sort=priceAsc");
  await addToCart(page, page.getByTestId("product-card").first());
  await page.goto("/sr/cart");
  await expect(page.getByTestId("min-order")).toContainText("Dodajte još proizvoda");
  await expect(page.getByTestId("checkout-link")).toHaveCount(0);
  await page.getByTestId("lang-ru").first().click();
  await expect(page).toHaveURL(/\/ru\/cart/);
  await expect(page.getByTestId("min-order")).toContainText("Добавьте товаров ещё на");
});

test("search understands Russian words", async ({ page }) => {
  await page.goto("/ru/catalog?q=молоко");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await expect(page.getByTestId("product-card").first()).toContainText(/mlek/i);
});
