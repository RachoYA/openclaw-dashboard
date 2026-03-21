# 🏢 OpenClaw Agent Dashboard

Анимированный real-time дашборд для мониторинга AI-агентов OpenClaw. Виртуальный офис в стиле The Sims — каждый агент отображается как персонаж с анимацией текущего действия.

![Status](https://img.shields.io/badge/status-alpha-orange)
![React](https://img.shields.io/badge/React-19-blue)
![PixiJS](https://img.shields.io/badge/PixiJS-8-green)

## ✨ Возможности

- 🎮 **Изометрический офис** — 5 тематических зон (PM Board, Dev Corner, QA Lab, Analyst Desk, DevOps Room)
- 👾 **Анимированные агенты** — idle, coding, testing, deploying, sleeping
- 📡 **Real-time данные** — WebSocket подключение к OpenClaw
- 📊 **KPI карточки** — Active agents, Tasks, PRs, Deploys, Bugs
- 📋 **Activity Feed** — лента событий в реальном времени
- 🗺️ **Timeline & Heatmap** — визуализация активности
- 📱 **Responsive** — desktop + mobile
- ☀️ **Светлая/тёмная тема**

## 🚀 Quick Start

```bash
# 1. Клонировать
git clone https://github.com/RachoYA/openclaw-dashboard.git
cd openclaw-dashboard

# 2. Установить зависимости
npm install

# 3. Запустить dev-сервер
npm run dev

# 4. Открыть
# http://localhost:5173
```

### BFF (Backend-for-Frontend)

```bash
cd bff
npm install
node server.js
# WebSocket сервер на порту 3101
```

## 🏗️ Стек технологий

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| UI Framework | React | 19 |
| 2D Rendering | PixiJS | 8.6 |
| React-PixiJS | @pixi/react | 8.0 |
| State | Zustand | 5.0 |
| Real-time | WebSocket (native) | — |
| Build | Vite + TypeScript | — |
| BFF | Node.js + ws | — |

## 📁 Структура проекта

```
openclaw-dashboard/
├── src/
│   ├── App.tsx                  # Главный компонент
│   ├── main.tsx                 # Entry point
│   ├── data/
│   │   ├── AgentStore.ts        # Zustand store — состояние агентов
│   │   ├── ActivityStore.ts     # Zustand store — лента событий
│   │   ├── ws-client.ts         # WebSocket клиент
│   │   └── types.ts             # TypeScript типы
│   ├── engine/
│   │   ├── Scene.tsx            # PixiJS сцена (главный Canvas)
│   │   ├── OfficeZones.ts       # Определение зон офиса
│   │   ├── SpriteGenerator.ts   # Процедурная генерация спрайтов
│   │   ├── SpriteLoader.ts      # Загрузка PNG спрайтов
│   │   ├── AgentMovement.ts     # Логика перемещения агентов
│   │   ├── Animations.ts        # Анимации персонажей
│   │   ├── MessageParticle.ts   # Частицы сообщений между агентами
│   │   ├── Pathfinding.ts       # Навигация по офису
│   │   ├── isometric.ts         # Изометрические преобразования
│   │   └── SoundManager.ts      # Звуковые эффекты
│   ├── ui/
│   │   ├── Sidebar.tsx          # Боковая панель KPI
│   │   ├── AgentPanel.tsx       # Slide-in панель при клике на агента
│   │   ├── ActivityFeed.tsx     # Лента событий
│   │   ├── Metrics.tsx          # KPI карточки
│   │   ├── Timeline.tsx         # Timeline активности
│   │   ├── Heatmap.tsx          # Heatmap активности
│   │   ├── ZoomControls.tsx     # Zoom +/−/reset
│   │   ├── TaskButton.tsx       # Кнопка создания задач
│   │   ├── ThemeToggle.tsx      # Переключатель темы
│   │   └── ConnectionBadge.tsx  # Индикатор LIVE/DEMO
│   └── hooks/
│       ├── useIsMobile.ts       # Определение мобильного устройства
│       └── useTheme.ts          # Хук темы
├── bff/
│   ├── server.js                # WebSocket BFF сервер
│   ├── Dockerfile               # Docker для BFF
│   └── package.json
├── public/
│   └── assets/sprites/          # PNG спрайты (6 персонажей, 12 мебель, 10 иконок, 7 UI)
├── docs/
│   ├── ARCHITECTURE.md          # Архитектурная оценка
│   ├── requirements.md          # Требования к продукту
│   ├── office-zones-design.md   # Дизайн зон офиса
│   └── visual-upgrade-research.md # Ресёрч визуального стиля
├── ASSETS.md                    # Кредиты и план ассетов
└── package.json
```

## 🔧 Конфигурация

### Environment Variables

| Переменная | Описание | Default |
|-----------|----------|---------|
| `VITE_WS_URL` | WebSocket URL | `/db/ws` (relative) |
| `VITE_THEME` | Тема по умолчанию | `light` |

### Деплой (nginx)

```nginx
# Статика дашборда
location /db/ {
    alias /path/to/openclaw-dashboard/dist/;
    try_files $uri $uri/ /db/index.html;
}

# WebSocket proxy
location /db/ws {
    proxy_pass http://127.0.0.1:3101;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

## 📖 Документация

- [Архитектура](docs/ARCHITECTURE.md) — стек, источники данных, решения
- [Требования](docs/requirements.md) — полная спецификация продукта
- [Дизайн зон](docs/office-zones-design.md) — 5 зон офиса с wireframes
- [Визуальный ресёрч](docs/visual-upgrade-research.md) — ассеты, стили, план апгрейда
- [Ассеты](ASSETS.md) — кредиты и лицензии

## 📝 Лицензия

MIT
