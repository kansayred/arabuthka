# Руководство по внесению изменений в Arabuthka

Спасибо, что хочешь помочь проекту! Ниже описаны правила и рекомендации.

## 🚀 Как начать

1. **Сделай форк** репозитория
2. **Клонируй** к себе:
   ```bash
   git clone https://github.com/YOUR_USERNAME/arabuthka.git
   ```
3. **Установи зависимости**:
   ```bash
   # Backend
   cd bot && npm install
   
   # Frontend
   cd webapp && npm install
   ```

## 📝 Правила оформления кода

### Общие правила

- **Комментарии** пиши на русском языке
- **Коммиты** тоже на русском
- Используй **2 пробела** для отступов
- Используй **одинарные кавычки** для строк
- Прогоняй **ESLint** перед коммитом

### Формат коммитов

```
Тип: Краткое описание

Подробное описание (опционально)
```

**Типы коммитов:**
- `Добавлен` - новый функционал
- `Исправлен` - багфикс
- `Улучшен` - рефакторинг
- `Документация` - изменения в доках

## 📁 Структура проекта

```
arabuthka/
├── bot/                 # Backend (Node.js + Express)
│   ├── middleware/      # Middleware функции
│   ├── utils/           # Утилиты
│   └── index.js         # Точка входа
├── webapp/              # Frontend (React)
├── telegram/            # Telegram Mini App
└── docs/                # Документация
```

## 🔄 Процесс Pull Request

1. Создай ветку с описательным именем:
   ```bash
   git checkout -b feature/новая-фича
   ```
2. Внеси изменения и закоммить
3. Отправь в свой форк:
   ```bash
   git push origin feature/новая-фича
   ```
4. Создай Pull Request

## 🛠 Локальный запуск

### Backend
```bash
cd bot
cp .env.example .env
# Заполни .env
npm run dev
```

### Frontend
```bash
cd webapp
npm run dev
```

## ❓ Вопросы?

Если что-то непонятно, создай [Issue](https://github.com/kansayred/arabuthka/issues) или напиши в обсуждениях.
