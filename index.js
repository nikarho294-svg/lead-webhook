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

// === Разбор сообщения пользователя ===
function parseLead(text) {
  const parts = text.split(/[\|\;\,]\s*/).map(v => v.trim()).filter(Boolean)
  if (parts.length < 4) return null
  const [bank, phoneRaw, account, sumRaw] = parts
  const phone = phoneRaw.replace(/[^\d\+]/g, '')
  const sum = String(sumRaw).trim()
  return { bank, phone, account, sum }
}

// === /start ===
bot.start(ctx => {
  ctx.reply(
    'Привет! Отправь данные в формате:\n' +
    'Банк | Номер | Счёт | Сумма\n\n' +
    'Пример:\nСбербанк | +79998887766 | 102 | 270'
  )
})

// === Обработка текстовых сообщений ===
bot.on('text', async ctx => {
  const parsed = parseLead(ctx.message.text)
  if (!parsed) {
    return ctx.reply('Формат неверный. Пример:\nСбербанк | +79998887766 | 102 | 270')
  }

  const { bank, phone, account, sum } = parsed
  const chatId = ctx.message.chat.id // Telegram ChatID

  // Формируем URL для запроса в Chatterfy
  const url = `${CHATTERFY_WEBHOOK}?chatId=${chatId}` +
              `&fields.bank%20name=${encodeURIComponent(bank)}` +
              `&fields.number=${encodeURIComponent(phone)}` +
              `&fields.account=${encodeURIComponent(account)}` +
              `&fields.sum=${encodeURIComponent(sum)}`

  try {
    await axios.get(url, { timeout: 10000 })
    await ctx.reply('✅ Данные успешно переданы в Chatterfy.')
  } catch (err) {
    console.error('Ошибка при отправке:', err.message)
    await ctx.reply('❌ Не удалось передать данные в Chatterfy.')
  }
})

// === Express сервер ===
const app = express()
app.use(bot.webhookCallback('/telegram-webhook'))
app.get('/telegram-webhook', (_, res) => res.send('OK'))
app.get('/', (_, res) => res.send('OK'))

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
