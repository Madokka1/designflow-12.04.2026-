# Деплой на VPS через GitHub Actions

## Что происходит

1. **CI** (`.github/workflows/ci.yml`) — `lint` и `build` в **pull request** в `main`/`master` и при push в **любые другие ветки** (в `main`/`master` только деплой, без дубля сборки в CI).
2. **Deploy** (`.github/workflows/deploy.yml`) — при push в `main`/`master`: `lint`, `build`, затем **rsync** каталога `dist/` на VPS по SSH.

Сборка — чистый фронт (Vite). На VPS нужен только веб-сервер (nginx и т.п.), который отдаёт файлы и для всех путей отдаёт `index.html` (см. `nginx.example.conf`).

## Секреты GitHub

**Settings → Secrets and variables → Actions → New repository secret**

| Имя | Описание |
|-----|----------|
| `VPS_HOST` | IP или домен VPS |
| `VPS_USER` | SSH-пользователь (например `deploy` или `root`) |
| `VPS_SSH_PRIVATE_KEY` | Приватный ключ **целиком** (`-----BEGIN ... END-----`), пароль от ключа в Actions не поддерживается — используйте ключ без passphrase или другой способ |
| `VPS_DEPLOY_PATH` | Абсолютный путь к каталогу сайта на сервере, **с завершающим /** (например `/var/www/asdawd/`) |
| `VPS_PORT` | (необязательно) порт SSH, по умолчанию `22` |

Опционально для подстановки в билд (если используете `VITE_SUPABASE_*`):

| Имя | Описание |
|-----|----------|
| `VITE_SUPABASE_URL` | URL проекта Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key |

В **CI** для веток можно задать те же значения как **Variables** (не секреты), если нужны только для успешной сборки в PR.

## Окружение `production` в Deploy

В workflow указано `environment: production`. В репозитории: **Settings → Environments → production** — можно включить required reviewers или ограничить секреты только этим окружением.

## Подготовка сервера (один раз)

```bash
sudo mkdir -p /var/www/asdawd
sudo chown -R "$USER:$USER" /var/www/asdawd   # или пользователь, под которым идёт SSH
```

Добавьте **публичный** ключ в `~/.ssh/authorized_keys` пользователя деплоя.

Настройте nginx (`nginx.example.conf`), затем:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Ветки

Триггеры: `main` и `master`. При необходимости измените список в YAML.
