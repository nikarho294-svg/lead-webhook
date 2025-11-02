import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import { Telegraf } from 'telegraf'

const { BOT_TOKEN, PUBLIC_URL, CHATTERFY_WEBHOOK, PORT = 10000 } = process.env

if (!BOT_TOKEN || !PUBLIC_URL || !CHATTERFY_WEBHOOK) {
  console.error('❌ Missing env vars. Check BOT_TOKEN, PUBLIC_URL, CHATTERFY_WEBHOOK.')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)

// === Функция для разбора входящих сообщений ===
function parseLead(text) {
  // разделяем по | ; , и пробелам
  const parts = text.split(/[\|\;\,]\s*/).map(v => v.trim()).filter(Boolean)
  if (parts.length < 4) return null

  const [bank, phoneRaw, account, sumRaw] = parts
  const phone = phoneRaw.replace(/[^\d\+]/g, '')
  const sum = String(sumRaw).trim()

  if (!bank || !phone || !account || !sum) return null
  return { bank, phone, account, sum }
}

// === Команда /start ===
bot.start(ctx => {
  ctx.reply(
    'Привет! Отправь данные в формате:\n' +
    'Банк | Номер | Счёт | Сумма\n\n' +
    'Пример:\nСбербанк | +79998887766 | 102 | 270'
  )
})

// === Обработка всех текстовых сообщений ===
bot.on('text', async ctx => {
  const parsed = parseLead(ctx.message.text)
  if (!parsed) {
    return ctx.reply('Формат неверный. Пример:\nСбербанк | +79998887766 | 102 | 270')
  }

  const { bank, phone, account, sum } = parsed

  // === Формируем payload для Chatterfy ===
  const payload = {
    fields: {
      "bank name": bank,
      "number": phone,
      "account": account,
      "sum": sum
    }
  }

  try {
    await axios.post(CHATTERFY_WEBHOOK, payload, { timeout: 10000 })
    await ctx.reply('✅ Данные отправлены в Chatterfy.')
  } catch (err) {
    console.error('Ошибка при отправке:', err.message)
    await ctx.reply('❌ Не удалось передать данные в Chatterfy.')
  }
})

// === Запуск express-сервера ===
const app = express()

// POST-запросы от Telegram
app.use(bot.webhookCallback('/telegram-webhook'))

// GET-запрос — чтобы Telegram не получал 404
app.get('/telegram-webhook', (req, res) => {
  res.status(200).send('OK')
})

// Проверка, что сервер жив
app.get('/', (_, res) => res.send('OK'))

// === Запуск сервера ===
app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`)
  const webhookUrl = `${PUBLIC_URL}/telegram-webhook`
  try {
    await bot.telegram.setWebhook(webhookUrl)
    console.log(`🤖 Telegram webhook установлен: ${webhookUrl}`)
  } catch (err) {
    console.error('Ошибка при установке webhook:', err.message)
  }
})
