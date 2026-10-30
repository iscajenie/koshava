import "server-only";
import { getDictionary } from "@/i18n";
import { getOrder } from "@/lib/orders";
import { orderMessage } from "@/lib/order-message";
import { getTelegramSettings, sendMessage } from "@/lib/telegram";

/**
 * Tells the connected Telegram chats about a new order, each in the language it was connected in. Runs after
 * the checkout response (see placeOrder); a failure is logged and never reaches the customer.
 */
export async function notifyNewOrder(orderId: number, origin: string) {
  try {
    const settings = await getTelegramSettings();
    if (!settings?.chats.length) return;
    const order = await getOrder({ id: orderId });
    if (!order) return;
    await Promise.all(
      settings.chats.map(async (chat) => {
        const text = orderMessage(order, getDictionary(chat.locale), chat.locale, `${origin}/${chat.locale}/admin/orders/${order.id}`);
        try {
          await sendMessage(settings.token, chat.id, text);
        } catch (error) {
          console.error(`Telegram notification to ${chat.id} failed:`, error);
        }
      }),
    );
  } catch (error) {
    console.error("Order notification failed:", error);
  }
}
