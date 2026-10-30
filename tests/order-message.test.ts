import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n";
import { orderMessage, type OrderForMessage } from "@/lib/order-message";

const order: OrderForMessage = {
  number: "KS-00012",
  subtotalMinor: 5000_00,
  deliveryFeeMinor: 500_00,
  totalMinor: 5500_00,
  customerName: "Ana <Petrović>",
  phone: "+381 60 123 4567",
  address: { street: "Bulevar Mihajla Pupina", house: "12", apartment: "5", municipality: "Novi Beograd" },
  deliveryDate: "2026-10-31",
  deliverySlot: "10",
  paymentMethod: "cash",
  comment: "Pozvati 15 min ranije & ne zvoniti",
  items: [
    { name: "Jogurt 2,8% 1kg", unit: "kom", qty: 2, lineTotalMinor: 259_98 },
    { name: "Banane", unit: "kg", qty: 1.5, lineTotalMinor: 194_99 },
  ],
};

describe("orderMessage", () => {
  it("lists what the courier needs, the items and the admin link, with customer text escaped", () => {
    const text = orderMessage(order, getDictionary("ru"), "ru", "https://koshava.vercel.app/ru/admin/orders/12");
    expect(text).toContain("<b>Новый заказ KS-00012</b>");
    expect(text).toContain("<b>5 500,00 дин.</b>: товары 5 000,00 дин., доставка 500,00 дин.");
    expect(text).toContain("Доставка: 31 октября, 10:00");
    expect(text).toContain("Ana &lt;Petrović&gt;, +381 60 123 4567");
    expect(text).toContain("Bulevar Mihajla Pupina 12, квартира 5, Novi Beograd");
    expect(text).toContain("Комментарий к заказу: Pozvati 15 min ranije &amp; ne zvoniti");
    expect(text).toContain("Товары (2):\n2 шт. × Jogurt 2,8% 1kg — 259,98 дин.\n1,5 кг × Banane — 194,99 дин.");
    expect(text).toContain('<a href="https://koshava.vercel.app/ru/admin/orders/12">Открыть в админке</a>');
  });

  it("stays under Telegram's limit for long orders", () => {
    const items = Array.from({ length: 70 }, (_, i) => ({ name: `Proizvod sa dugim nazivom broj ${i}`, unit: "kom", qty: 1, lineTotalMinor: 100_00 }));
    const text = orderMessage({ ...order, comment: "x".repeat(1000), items }, getDictionary("sr"), "sr", "https://koshava.vercel.app/sr/admin/orders/12");
    expect(text).toContain("Nova porudžbina KS-00012");
    expect(text).toContain("…i još 30");
    expect(text.length).toBeLessThan(4096);
  });
});
