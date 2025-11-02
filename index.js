import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import { Telegraf } from 'telegraf'
import { google } from 'googleapis'

const {
  BOT_TOKEN,
  PUBLIC_URL,
  CHATTERFY_WEBHOOK,
  PORT = 10000,
  SPREADSHEET_ID,
  GOOGLE_CREDENTIALS
} = process.env

if (!BOT_TOKEN || !PUBLIC_URL || !CHATTERFY_WEBHOOK || !SPREADSHEET_ID) {
  console.error('❌ Missing env vars. Check BOT_TOKEN, PUBLIC_URL, CHATTERFY_WEBHOOK, SPREADSHEET_ID.')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)
const app = express()

// === Авторизация Google Sheets ===
let auth
try {
  const credentials = GOOGLE_CREDENTIALS
    ? JSON.parse(GOOGLE_CREDENTIALS)
    : JSON.parse(await import('fs').then(fs => fs.readFileSync('./service-account.json', 'utf8')))

  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  })
  console.log('✅ Авторизация Google API успешна')
} catch (err) {
  console.error('❌ Ошибка при инициализации Google API:', err.message)
}
const sheets = google.sheets({ version: 'v4', auth })

// === Получение chatId из таблицы (колонка C) ===
async function getAllChatIds() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'C:C'
    })

    const validIds = (res.data.values || [])
      .flat()
      .map(id => parseInt(id))
      .filter(id => !isNaN(id) && id > 100000)

    console.log('📋 Найдено chatId в таблице:', validIds)
    return validIds
  } catch (err) {
    console.error('❌ Ошибка при чтении Google Sheets:', err.message)
    return []
  }
}

// === Разбор входного текста ===
function parseLead(text) {
  const parts = text.split(/[\|\;\,]\s*/).map(v => v.trim()).filter(Boolean)
  if (parts.length < 4) return null
  const [bank, phoneRaw, account, sumRaw] = parts
  const phone = phoneRaw.replace(/[^\d\+]/g, '') // <-- исправлено
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
  await ctx.reply('⏳ Загружаю список пользователей из Google Sheets...')

  const allChatIds = await getAllChatIds()
  if (!allChatIds.length) {
    return ctx.reply('⚠️ Не найдено ни одного Chat ID в Google Sheets.')
  }

  await ctx.reply(`📤 Найдено ${allChatIds.length} пользователей. Начинаю обновление...`)

  let success = 0
  for (const chatId of allChatIds) {
    const url = `${CHATTERFY_WEBHOOK}?chatId=${chatId}` +
                `&fields.bank%20name=${encodeURIComponent(bank)}` +
                `&fields.number=${encodeURIComponent(phone)}` +
                `&fields.account=${encodeURIComponent(account)}` +
                `&fields.sum=${encodeURIComponent(sum)}`
    try {
      await axios.get(url)
      console.log(`✅ Обновлён chatId: ${chatId}`)
      success++
    } catch (err) {
      console.error(`❌ Ошибка для chatId ${chatId}:`, err.message)
    }
  }

  ctx.reply(`✅ Успешно обновлено ${success} пользователей из ${allChatIds.length}.`)
})

// === Express сервер ===
app.use(bot.webhookCallback('/telegram-webhook'))
app.get('/telegram-webhook', (_, res) => res.send('OK')) // важно: чтобы Telegram видел ответ
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
