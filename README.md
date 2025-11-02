# Lead Webhook (Telegram → Chatterfy)

## 🚀 Deploy on Render

1. Создай новый Web Service → выбери "Public Git Repository".
2. Загрузите эти файлы в свой GitHub и вставь ссылку в Render.
3. В Render → Environment добавь переменные:
   - BOT_TOKEN
   - PUBLIC_URL
   - CHATTERFY_WEBHOOK
   - PORT = 10000
4. Build Command: `npm install`
5. Start Command: `npm start`
6. После деплоя — проверь `/telegram-webhook` и напиши `/start` в Telegram.
