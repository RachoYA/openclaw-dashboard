# Changelog

All notable changes to OpenClaw Agent Dashboard.

## [0.1.0] — 2026-03-21

### Added
- Изометрический офис с 5 тематическими зонами (PM Board, Dev Corner, QA Lab, Analyst Desk, DevOps Room)
- 6 анимированных агентов с уникальными цветами и ролями
- Canvas 2D рендеринг с процедурной генерацией спрайтов
- PNG спрайтшиты: 6 персонажей, 12 мебель, 10 иконок, 7 UI элементов
- KPI карточки (Active, Sleeping, Tasks, PRs, Deploys, Bugs)
- Activity Feed с real-time событиями
- WebSocket клиент (/db/ws)
- BFF сервер (Node.js + ws, порт 3101)
- Timeline и Heatmap визуализации
- Zoom контролы (+/−/reset)
- Светлая и тёмная темы
- Мобильная адаптация
- LIVE/DEMO индикатор подключения
- Кнопка «Новая задача»
- Pathfinding для перемещения агентов между зонами

### Documentation
- ARCHITECTURE.md — архитектурная оценка
- requirements.md — полные требования (467 строк)
- office-zones-design.md — дизайн 5 зон с wireframes
- visual-upgrade-research.md — ресёрч визуального стиля
- ASSETS.md — кредиты и план интеграции ассетов
- README.md — quick start, стек, структура, деплой

### Known Issues
- WebSocket /db/ws требует nginx proxy (issue #47)
- Панель агента при клике — WIP (issue #38)
- Спрайты процедурные — планируется миграция на HD ассеты
