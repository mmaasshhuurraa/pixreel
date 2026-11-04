# PixReel

Собирает фото и видеоролики почти любых форматов в одно видео: MP4, MOV, WebM, MKV, AVI, WMV или GIF.
Между кадрами 13 эффектов перехода (плавный, через чёрный/белый, сдвиги, шторки, приближение, круг) или случайный.

- **Веб-приложение** (`web/`): React + Vite. Видео собирается прямо в браузере через WebCodecs, файлы никуда не загружаются.
- **API** (`api/`): FastAPI + ffmpeg. Открывает то, что не умеет браузер (RAW, PSD, PDF, TIFF, HEIC, EXR...), и делает GIF. Это же API будут использовать будущие приложения под другие платформы.

## Форматы

| Группа | Расширения |
|---|---|
| Обычные | JPG, PNG, WebP, GIF, BMP, ICO, TGA, QOI, PCX, PPM… |
| Современные | HEIC/HEIF (iPhone), AVIF, JPEG XL, JPEG 2000 |
| Анимированные | GIF, APNG, WebP: проигрываются со своими задержками |
| Профессиональные | TIFF (в т. ч. 16 бит), PSD, EXR, HDR, XCF, DDS |
| RAW камер | CR2, CR3, NEF, ARW, DNG, ORF, RAF, RW2, PEF, SRW и др. |
| Векторные и документы | SVG, PDF (каждая страница становится кадром) |
| Видео | MP4, MOV, WebM, MKV; на сервере ещё AVI, WMV, FLV, 3GP, MPG, TS, MTS, OGV |

AVI и WMV в браузере делаются через ffmpeg.wasm (~32 МБ, загружается только при выборе этих форматов).

Сейчас сайт работает без сервера, поэтому в нём включены только форматы, проверенные в браузере:
JPG, PNG, APNG, WebP, GIF, AVIF, BMP, SVG, ICO и видео MP4, MOV, WebM, MKV. Список задаётся в `web/src/formats.ts`.

Полный список форматов сервера отдаёт `GET /v1/formats`.

## Как это работает

В режиме «Авто» веб-приложение рендерит в браузере, если браузер может открыть все файлы. Если нет (например, RAW) или нужен GIF, файлы уходят на сервер.

```
web/   React-приложение → GitHub Pages
api/   FastAPI + ffmpeg  → Hugging Face Spaces (Docker)
docs/  API.md и openapi.json
```

## Бесплатный хостинг

### Сайт: GitHub Pages
1. Settings → Pages → Source: **GitHub Actions**.
2. После пуша в `main` сайт появится на `https://<user>.github.io/pixreel/`.

### API: Hugging Face Spaces (бесплатно: 2 vCPU, 16 ГБ RAM)
1. Зарегистрируйтесь на huggingface.co и создайте токен с правом **write**: https://huggingface.co/settings/tokens
2. В репозитории: Settings → Secrets and variables → Actions:
   - **Secrets** → `HF_TOKEN` = токен;
   - **Variables** → `HF_SPACE` = `<hf-user>/pixreel-api`;
   - **Variables** → `API_URL` = `https://<hf-user>-pixreel-api.hf.space`.
3. Запустите Actions → **Deploy API** (или запушьте изменения в `api/`). Space создастся сам.
4. Перезапустите **Deploy web**, чтобы сайт узнал адрес API.

Бесплатный Space засыпает после ~48 часов без запросов. Первый запрос после сна будит его примерно за минуту.

## Локальная разработка

```bash
# API (нужен ffmpeg)
cd api && pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 7860
pytest -q

# Веб
cd web && npm install
VITE_API_URL=http://localhost:7860 npm run dev
```

## API

Описание: [docs/API.md](docs/API.md). По [docs/openapi.json](docs/openapi.json) можно сгенерировать клиентов для iOS, Android и десктопа.

```bash
curl -F files=@1.jpg -F files=@2.heic -F duration=3 -F transition=crossfade -o video.mp4 \
  https://<hf-user>-pixreel-api.hf.space/v1/convert
```

## Ветки и релизы

- `main`: только релизы. Каждый пуш в `main` публикует сайт.
- `develop`: текущая разработка.
- `feature/<название>`: отдельная ветка на каждую фичу, создаётся от `develop` и вливается обратно в `develop`.
- Релиз: `develop` вливается в `main`, затем ставится тег `vX.Y.Z` и обновляется [CHANGELOG.md](CHANGELOG.md).
  Версия задаётся в `web/package.json` и `api/app/__init__.py`.
