const express = require('express');
const https = require('https');
const fs = require('fs');
const Twig = require('twig');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;
const HTTPS_PORT = process.env.HTTPS_PORT || 3005;
const audioPath = path.join("C:/PetPjjrojects/asiAssistant/shared_audio");

// Настройка Twig
app.set('view engine', 'twig');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use("/audio", express.static(audioPath));


// SSL сертификаты
const credentials = {
  key: fs.readFileSync("./ssl/zhetysu.edu.kz-private.key", 'utf8'),
  cert: fs.readFileSync('./ssl/_zhetysu_edu_kz.crt', 'utf8'),
  ca: fs.readFileSync('./ssl/_zhetysu_edu_kz.ca-bundle', 'utf8')
};

// Главная страница
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Голосовой AI Ассистент'
  });
});

// API endpoint для LLM
app.post('/api/llm', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Текст не предоставлен' });
    }

    console.log('📥 Получен запрос:', text);

    // Настройки Ollama
    const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.2:latest';

    // Формируем промпт
    const prompt = `Ты голосовой ассистент. Отвечай кратко и по существу на русском языке.

  Вопрос пользователя: ${text}

  Твой ответ:`;

    console.log('🤖 Отправляем в Ollama...');

    // Запрос к Ollama
    const response = await axios.post(`${ollamaUrl}/api/generate`, {
      model: model,
      prompt: prompt,
      stream: false
    }, {
      timeout: 60000 // 60 секунд таймаут
    });

    const answer = response.data.response || 'Извините, не смог сформировать ответ.';

    console.log('✅ Получен ответ:', answer.substring(0, 50) + '...');

    res.json({
      response: answer,
      success: true
    });

  } catch (error) {
    console.error('❌ Ошибка LLM API:', error.message);

    if (error.code === 'ECONNREFUSED') {
      return res.status(500).json({
        error: 'Не удалось подключиться к Ollama. Убедитесь, что Ollama запущен.',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Ошибка генерации ответа',
      details: error.message
    });
  }
});

// API TTS через Silero Python
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст не предоставлен' });

    console.log('🔊 TTS запрос:', text.substring(0, 50) + '...');

    // Отправляем запрос к Python Silero API
    const response = await axios.post('http://127.0.0.1:8000/synthesize/', {
      text: text
    });

    const { file_id } = response.data; // Python возвращает file_id

    console.log('✅ Аудио сгенерировано:', file_id);

    // Возвращаем только имя файла (файл будет доступен через /audio/)
    res.json({ file: `${file_id}.wav` });
  } catch (err) {
    console.error('❌ TTS ошибка:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// Создаем HTTPS сервер
const httpsServer = https.createServer(credentials, app);

// Запуск HTTPS сервера
httpsServer.listen(HTTPS_PORT, () => {
  console.log('🚀 HTTPS Сервер запущен!');
  console.log(`🔒 HTTPS URL: https://localhost:${HTTPS_PORT}`);
  console.log(`🤖 Ollama URL: ${process.env.OLLAMA_API_URL || 'http://localhost:11434'}`);
  console.log(`🧠 Модель: ${process.env.OLLAMA_MODEL || 'llama3.2:latest'}`);
  console.log('\n💡 Откройте браузер и перейдите на https://localhost:' + HTTPS_PORT);
  console.log('⚠️  Если браузер показывает предупреждение о сертификате - это нормально для локальной разработки');
});

// Опционально: HTTP сервер для редиректа на HTTPS
const http = require('http');
http.createServer((req, res) => {
  // res.writeHead(301, { "Location": `https://${req.headers.host.split(':')[0]}:${HTTPS_PORT}${req.url}` });
  res.end();
}).listen(PORT, () => {
  console.log(`📍 HTTP редирект с :${PORT} на HTTPS :${HTTPS_PORT}`);
});
