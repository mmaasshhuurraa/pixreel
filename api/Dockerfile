FROM python:3.12-slim

# ffmpeg encodes video; ImageMagick decodes exotic formats (EXR, HDR, XCF...);
# libcairo renders SVG.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg imagemagick libcairo2 \
 && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run the container as uid 1000.
RUN useradd -m -u 1000 app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
USER app

ENV PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
