// Состояния ассистента
let state = 'idle'; // idle, listening, processing, speaking

// Элементы DOM
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const circleContainer = document.getElementById('circleContainer');
const stateLabel = document.getElementById('stateLabel');
const transcriptBox = document.getElementById('transcriptBox');
const transcriptText = document.getElementById('transcript');
const responseBox = document.getElementById('responseBox');
const responseText = document.getElementById('response');

// Speech Recognition
let recognition = null;
let audioContext = null;
let analyser = null;
let audioLevel = 0;

// Инициализация Speech Recognition
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert('Speech Recognition не поддерживается вашим браузером. Используйте Chrome, Edge или Safari.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'ru-RU'; // Русский язык
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log('✅ Speech recognition STARTED');
    setState('listening');
  };

  recognition.onspeechstart = () => {
    console.log('🎤 Речь обнаружена!');
  };

  recognition.onspeechend = () => {
    console.log('🔇 Речь закончилась');
  };

  recognition.onresult = async (event) => {
    console.log('📝 Получен результат!');

    const last = event.results.length - 1;
    const result = event.results[last];

    console.log('Финальный?', result.isFinal);
    console.log('Текст:', result[0].transcript);

    // Обрабатываем только финальный результат
    if (result.isFinal) {
      const text = result[0].transcript;
      console.log('✅ ФИНАЛЬНЫЙ ТЕКСТ:', text);

      // Показываем распознанный текст
      transcriptText.textContent = text;
      transcriptBox.style.display = 'block';

      setState('processing');

      // Отправляем на LLM
      try {
        const response = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Ответ получен:', data.response.substring(0, 50) + '...');

        // Показываем ответ
        responseText.textContent = data.response;
        responseBox.style.display = 'block';

        // Озвучиваем ответ
        setState('speaking');
        speakText(data.response);
      } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('Ошибка при обработке запроса. Проверьте, что Ollama запущен.');
        setState('idle');
      }
    } else {
      // Промежуточный результат
      console.log('⏳ Промежуточный:', result[0].transcript);
    }
  };

  recognition.onerror = (event) => {
    console.error('❌ Ошибка распознавания:', event.error);

    if (event.error === 'no-speech') {
      alert('Речь не обнаружена. Попробуйте говорить громче.');
    } else if (event.error === 'not-allowed') {
      alert('Доступ к микрофону запрещен.');
    } else if (event.error === 'network') {
      alert('Ошибка сети. Проверьте интернет.');
    } else {
      alert('Ошибка: ' + event.error);
    }

    setState('idle');
  };

  recognition.onend = () => {
    console.log('🛑 Recognition ended');
    setTimeout(() => {
      if (state === 'listening') {
        console.warn('⚠️ Не получен результат');
        setState('idle');
      }
    }, 100);
  };

  console.log('✅ Speech Recognition инициализирован');
}

// Начать слушать
async function startListening() {
  if (!recognition) {
    alert('Speech Recognition не инициализирован');
    return;
  }

  try {
    console.log('🎙️ Начинаем распознавание...');

    // Настраиваем AudioContext для визуализации
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      // Обновление аудио уровня
      updateAudioLevel();
    } catch (err) {
      console.warn('⚠️ AudioContext недоступен:', err);
    }

    // Запускаем распознавание
    recognition.start();
    console.log('✅ Recognition запущен!');
  } catch (error) {
    console.error('❌ Ошибка запуска:', error);
    if (error.name === 'InvalidStateError') {
      alert('Распознавание уже запущено');
    } else {
      alert('Не удалось начать распознавание');
    }
  }
}

// Обновление уровня аудио для анимации
function updateAudioLevel() {
  if (analyser && state === 'listening') {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    audioLevel = average / 255;
    requestAnimationFrame(updateAudioLevel);
  }
}

// Text-to-Speech
// function speakText(text) {
//   if (!('speechSynthesis' in window)) {
//     console.error('Speech Synthesis не поддерживается');
//     setState('idle');
//     return;
//   }

//   const utterance = new SpeechSynthesisUtterance(text);
//   utterance.lang = 'ru-RU';

//   utterance.onstart = () => {
//     setState('speaking');
//   };

//   utterance.onend = () => {
//     setState('idle');
//   };

//   utterance.onerror = () => {
//     setState('idle');
//   };

//   window.speechSynthesis.speak(utterance);
// }


async function speakText(text) {
  try {
    console.log('🔊 Отправка на озвучку:', text.substring(0, 50) + '...');

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Получен аудио файл:', data.file);

    const audio = new Audio(`/audio/${data.file}`);

    setState('speaking');

    audio.onended = () => {
      console.log('✅ Воспроизведение завершено');
      setState('idle');
    };

    audio.onerror = (err) => {
      console.error('❌ Ошибка воспроизведения аудио:', err);
      setState('idle');
    };

    await audio.play();

  } catch (err) {
    console.error('❌ Ошибка TTS:', err);
    alert('Ошибка генерации речи. Проверьте, что Python API запущен на порту 8000.');
    setState('idle');
  }
}


// Установить состояние
function setState(newState) {
  state = newState;

  const labels = {
    idle: 'Готов',
    listening: 'Слушаю...',
    processing: 'Обрабатываю...',
    speaking: 'Говорю...'
  };

  stateLabel.textContent = labels[newState] || '';
  console.log('🔄 Состояние:', newState);
}

// Анимация круга
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const baseRadius = 100;

  let scale = 1;

  // Анимация в зависимости от состояния
  switch (state) {
    case 'idle':
      scale = 1 + Math.sin(Date.now() * 0.002) * 0.1;
      break;
    case 'listening':
      scale = 1 + audioLevel * 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
      break;
    case 'processing':
      scale = 1 + Math.sin(Date.now() * 0.001) * 0.15;
      break;
    case 'speaking':
      scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
      break;
  }

  const radius = baseRadius * scale;

  // Градиент
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

  // Цвета по состояниям
  switch (state) {
    case 'idle':
      gradient.addColorStop(0, 'rgba(100, 100, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(100, 100, 255, 0.2)');
      break;
    case 'listening':
      gradient.addColorStop(0, 'rgba(255, 100, 100, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 100, 100, 0.2)');
      break;
    case 'processing':
      gradient.addColorStop(0, 'rgba(255, 255, 100, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 100, 0.2)');
      break;
    case 'speaking':
      gradient.addColorStop(0, 'rgba(100, 255, 100, 0.8)');
      gradient.addColorStop(1, 'rgba(100, 255, 100, 0.2)');
      break;
  }

  // Рисуем круг
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Обводка
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 3;
  ctx.stroke();

  requestAnimationFrame(animate);
}

// Обработчик клика
circleContainer.addEventListener('click', () => {
  if (state === 'idle') {
    startListening();
  }
});

// Инициализация
window.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Приложение загружено');
  initSpeechRecognition();
  animate();
});
