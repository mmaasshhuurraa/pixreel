# Developer APIs & OSS libraries for programmatic image→video (PixReel API benchmarks)

All facts accessed 2026-11-05. **Method caveat:** in this research session most vendor domains (shotstack.io, creatomate.com, json2video.com, remotion.dev, dev.to, etc.) could NOT be fetched directly (network allowlist). Vendor facts below come from web-search results summarizing official pages (URL = the official page the search surfaced) or third-party pages. Items marked **[3rd-party]** are from aggregators/competitor blogs; **[unverified]** means sources conflict or only one weak source. GitHub pages and the npm/PyPI registries WERE fetched directly.

## 1. Request model (JSON timeline/templates vs upload), sync/async, webhooks

### Takeaway
Every commercial competitor uses a **JSON timeline or template + media URLs** model with **async render + polling/webhook**. None uses a multipart "upload files and get a video" model like PixReel's `POST /v1/jobs`. This is a real gap: PixReel's model is simpler for mobile/desktop clients that hold local photos.

### Cited Findings
- Shotstack: Edit API (render requests) + Serve API + Ingest API (ingest = upload/fetch source media). Per-API-key rate limits are counted in a fixed 60-second window — [Shotstack limitations docs](https://shotstack.io/docs/guide/architecting-an-application/limitations.md)
- Creatomate: JSON source format ("RenderScript") or templates; outputs mp4/gif/jpg/png — [Creatomate JSON docs](https://www.creatomate.com/docs/json/introduction); [Creatomate GIF how-to](https://creatomate.com/how-to/api/convert-a-video-to-gif)
- JSON2Video: JSON describes the movie (scenes/elements) and renders to MP4 — [JSON2Video JSON-to-MP4](https://json2video.com/how-to/json-to-mp4/)
- Cloudinary video slideshow: `create_slideshow` is async and needs a `.clt` template stored in Cloudinary. Required: width and height. Defaults: duration 10 s, slide 3000 ms, transition 1000 ms. Completion comes through `notification_url`. To edit, you regenerate or overwrite — [Cloudinary video slideshow docs](https://cloudinary.com/documentation/video_slideshow_generation); [Aident action description](https://aident.ai/actions/cloudinary_tools/cloudinary_create_slideshow) [3rd-party]; [Cloudinary blog Laravel guest post](https://cloudinary.com/blog/guest_post/video-slideshows-with-cloudinary-and-laravel)
- Canva Connect API: export is async (create export job, then poll for status and download links). Formats: PDF, JPEG, PNG, GIF, PPTX, MP4, CSV. A "Get export formats" endpoint returns the formats each design supports. It exports existing Canva designs and does not compose a slideshow from uploaded images — [Canva Connect Exports API](https://canva.dev/docs/connect/api-reference/exports/); MP4 quality/orientation option per [Pipedream action](https://pipedream.com/apps/canva/actions/export-design) [3rd-party]
- Adobe Express Embed SDK: a client-side embedded editor, not a render API. It includes "mixed media export" and quick actions like trim video. Access requires business approval and is currently free once approved — [Adobe Embed SDK](https://developer.adobe.com/embed-sdk); [Adobe dev blog MAX 2023](https://blog.developer.adobe.com/adobe-express-at-max-2023-the-next-step-for-our-open-developer-platform-15cce8ed3f43). Community reports say v3→v4 video export hung (2024–Jan 2025) — [Adobe community](https://community.adobe.com/t5/adobe-express-embed-sdk-bugs/file-upload-in-progress/m-p/14996570)
- Rendi (FFmpeg-as-a-service): you submit raw ffmpeg commands with input URLs and pay by GB processed — [Rendi pricing](https://www.rendi.dev/pricing); [omidsaffari Rendi pricing review](https://omidsaffari.com/blog/rendi-pricing) [3rd-party]
- Bannerbear and Placid: template-based (design a template in the web UI, fill modifications through the API); video is billed per second — [Bannerbear vs Placid](https://www.bannerbear.com/blog/bannerbear-vs-placid/) [vendor, self-interested]
- Plainly: After Effects template–based rendering, with API workflows and batch rendering — [Plainly pricing](https://www.plainlyvideos.com/pricing); [Plainly help: pricing](https://help.plainlyvideos.com/docs/basics/pricing-and-security)
- Remotion: React code is the template. Rendering uses `@remotion/renderer`, CLI or Lambda; programmatic render calls count as "renders" for licensing — [Remotion license FAQ](https://www.remotion.dev/docs/license/faq)
- api.video and Mux are hosting/encoding/delivery APIs. They do not compose slideshows (encoding is free, and you pay for storage and delivery) — [Mux pricing docs](https://www.mux.com/docs/pricing/overview); [toolradar api.video pricing](https://toolradar.com/tools/api-video/pricing) [3rd-party]
- Renderforest: no official public developer API docs found. There is only an unofficial PHP SDK last updated Oct 2022 — [GitHub topic video-maker-api](https://github.com/topics/video-maker-api?l=php); [Toolquestor](https://toolquestor.com/es/vs/renderforest-vs-synthesia) [3rd-party]

### Inferences
- PixReel's direct multipart upload plus a sync `/v1/convert` is a differentiator for app backends: no need to host media at public URLs first. A JSON-with-URLs mode could be added later for parity with Shotstack/Creatomate/n8n/Zapier users.
- Webhooks (Shotstack, Cloudinary `notification_url`) are standard. PixReel should add a `callback_url` option on `POST /v1/jobs`.
- Canva/Adobe are not real competitors for automated slideshow rendering. They export user-designed content.

### Gaps
- I could not verify the exact webhook/callback field names for Shotstack, Creatomate and JSON2Video (sites not fetchable).
- I could not confirm whether Creatomate or JSON2Video accept direct file upload (vs URL only).

## 2. Input formats (HEIC/RAW/PSD/PDF), outputs (GIF/AVI/WMV), max resolution

### Takeaway
I found no competitor that documents HEIC/RAW/PSD/PDF/EXR image input, and none outputs AVI/WMV/MKV. Most output MP4 (plus GIF on some), and 4K is often gated behind high-volume plans. PixReel's input/output breadth is a strong, verifiable differentiator.

### Cited Findings
- Shotstack: up to 1080p by default. 4K is available on high-volume plans by contacting support — [Shotstack help API FAQs](https://help.shotstack.io/en/articles/16347832-api-faqs). Output options per Pipedream: MP4, GIF, JPG, PNG, BMP, MP3 — [Pipedream Shotstack start-render](https://pipedream.com/apps/shotstack/actions/start-render) [3rd-party]. Source files up to 5 GB each, sources + output ≤ 10 GB, render speed about 20 s per minute of video — [Shotstack help FAQs](https://help.shotstack.io/en/articles/16347832-api-faqs)
- Creatomate output: mp4, gif, jpg, png (no WebM found) — [Creatomate JSON docs](https://www.creatomate.com/docs/json/introduction)
- JSON2Video output: MP4. Resolutions range from low up to 1080p and 4K. Free plan capped at 1080p — [JSON2Video JSON-to-MP4](https://json2video.com/how-to/json-to-mp4/); [wireflow JSON2Video pricing](https://www.wireflow.ai/blog/json2video-pricing) [3rd-party]
- Canva export: MP4 and GIF (plus PDF/PNG/JPEG/PPTX/CSV) — [Canva Exports API](https://canva.dev/docs/connect/api-reference/exports/)
- Editly (OSS): accepts video, images, animated GIFs and alpha-channel media of "any size incl. 4K video and DSLR photos". Outputs MP4, MKV and GIF; `customOutputArgs` passes custom ffmpeg flags — [GitHub mifi/editly](https://github.com/mifi/editly)
- None of the HEIC/RAW/PSD/PDF/EXR searches found documented support at Creatomate or JSON2Video — (negative search result; see Gaps)

### Inferences
- "Upload iPhone HEIC / camera RAW / PSD / PDF pages and get MP4/WebM/GIF/MOV/AVI/WMV up to 4K on every plan" is a positioning line no benchmarked API matches (on the evidence found).
- Ungated 4K is a differentiator against Shotstack (4K on request only).

### Gaps
- I found no official input-format lists for Shotstack, Creatomate, JSON2Video, Bannerbear or Placid, so absence of HEIC etc. is unconfirmed. The official docs need checking.
- Cloudinary does accept many image formats for its general image transformations, but I did not verify this for the slideshow endpoint specifically.

## 3. Transitions, Ken Burns, text, audio mixing

### Takeaway
Commercial JSON APIs (Shotstack, Creatomate, JSON2Video) all offer transitions, text and soundtrack. The OSS tools Editly and FFCreator lead on transitions (gl-transitions; about 100 in FFCreator). Editly matches PixReel's multi-track audio with per-track volume, ducking and normalization. PixReel's 13 transitions are modest; its multi-track music with crossfade/gap/loop is competitive.

### Cited Findings
- Editly: random default transition (0.5 s), any gl-transitions effect, directional wipes. Ken Burns via `zoomDirection` (in/out/left/right) with `zoomAmount` default 0.1. Multiple `audioTracks` with per-track volume, cut points and start time; `detached-audio` layers; automatic audio crossfading, ducking and normalization — [GitHub mifi/editly](https://github.com/mifi/editly)
- FFCreator: "nearly a hundred kinds of scene transition animation effects". Global background audio, per-scene audio, optional video audio. Ken Burns not mentioned — [GitHub tnfe/FFCreator](https://github.com/tnfe/FFCreator)
- ffmpeg-concat: concatenates videos with OpenGL gl-transitions; default or per-transition settings and params; one optional audio track; CLI + Node API — [GitHub ffmpeg-concat](https://github.com/transitive-bullshit/ffmpeg-concat)
- Cloudinary slideshow: transition duration parameter (default 1000 ms), per-slide duration — [Cloudinary slideshow docs](https://cloudinary.com/documentation/video_slideshow_generation)
- Revideo: `<Video/>`/`<Audio/>` components with audio export and frame-accurate sync; parallelized rendering; a React `<Player/>` for previews — [GitHub revideo](https://github.com/redotvideo/revideo)

### Inferences
- PixReel could move to dozens of transitions cheaply via ffmpeg `xfade` (about 50+ built-ins) or gl-transitions, which would be a marketing win against "13".
- Ken Burns (zoompan) and text overlays/captions are standard expectations. Their absence from PixReel's option list is a gap to consider.

### Gaps
- I did not verify exact transition counts or audio-mixing features (multi-track, per-track volume) for Shotstack, Creatomate and JSON2Video.

## 4. Pricing (free tier, per minute/credit, plans, USD, 2026)

### Takeaway
Template/JSON render APIs cost roughly **$0.07–$0.40 per rendered minute** (Shotstack), with entry plans at **$39–$69/month**. Free tiers are small and watermarked (e.g., JSON2Video 600 s, watermark, 1-min max; Creatomate 50 trial credits). FFmpeg-as-a-service prices by compute/GB (Rendi free 50 GB/mo, Pro $25). Remotion self-hosting costs **$0.01/render (min $100/mo)** for companies of 4+.

### Cited Findings
- **Shotstack:** pay-as-you-go is 1 credit = 1 minute, billed per second. On subscriptions a credit buys more minutes: Starter 1.25, Pro 1.5, Scale 2, Volume 4 — [Shotstack pricing](https://shotstack.io/pricing/) (via search snippet). PAYG is about $0.30/min [3rd-party, toolradar](https://toolradar.com/tools/shotstack-video-api/pricing), or $0.40/min with a 25-credit minimum [older review, Plainly blog](https://www.plainlyvideos.com/blog/best-video-editing-api) **[conflict]**. Starter $39, Pro $99 (750 min, about $0.13/min), Scale $199 (2,000 min, about $0.10/min), 10k credits $700 (about $0.07/min) — [wireflow Shotstack pricing, Sept 2026](https://www.wireflow.ai/blog/shotstack-pricing) [3rd-party, unverified]
- **Creatomate:** Essential about $54/mo (2,000 credits) monthly, or about $41–45/mo billed annually; Growth $99/mo [3rd-party] — [Plainly Creatomate review Jan 2026](https://www.plainlyvideos.com/blog/creatomate-review); [wireflow](https://www.wireflow.ai/blog/creatomate-pricing); [toolradar](https://toolradar.com/tools/creatomate/pricing). Credits reset monthly with no rollover; 1 image = 1 credit — [Creatomate docs: how pricing works](https://creatomate.com/docs/account/how-does-the-pricing-work). A 1080p/30fps minute is about 37 credits; 720p/25fps is about 14 credits/min — [wireflow](https://www.wireflow.ai/blog/creatomate-pricing) [3rd-party]. Free trial: 50 credits, no card — [apis.io](https://apis.io/plans/creatomate/creatomate-plans-pricing/) [3rd-party]. API on all plans per the [Creatomate pricing page](https://creatomate.com/pricing); Plainly says Essential has no API **[conflict]**
- **JSON2Video:** free plan gives 600 credits (= 600 s of rendering), no card, watermark, max 1080p and 1-min videos — [JSON2Video plans docs](https://json2video.com/docs/v2/pricing/plans); [wireflow](https://www.wireflow.ai/blog/json2video-pricing). Hobby about $16.63/mo (yearly only, $199.50/yr) [3rd-party]. Other listings show $49.95/$99.95/$199.95 monthly subscriptions plus prepaid packs that never expire — [xpay.sh](https://www.xpay.sh/saas-pricing/json2video/) **[unverified/conflicting]**
- **Remotion:** free for individuals and companies of ≤3 people. "Creators" costs $25/seat/month. "Automators" (programmatic renders) costs $0.01/render with a $100/month minimum. Enterprise starts at $500/mo — [Remotion pricing](https://www.remotion.dev/docs/license/pricing); [Remotion license FAQ](https://www.remotion.dev/docs/license/faq) (via search snippet). Lambda AWS costs come on top (not verified here).
- **Rendi:** Free $0 (4 vCPU, about 50 GB processing/mo, 1-min max command runtime, 5 GB-month storage); Pro $25/mo (250 GB, 10-min runtime, 50 GB-month) — [Rendi pricing](https://www.rendi.dev/pricing); [omidsaffari Rendi review Sept 2026](https://omidsaffari.com/blog/rendi-pricing) [3rd-party]. The free tier may need a $5 refundable card hold **[conflict]** — [agentdeals](https://agentdeals.dev/vendor/rendi); [freetier.co](https://freetier.co/directory/products/rendi)
- **Bannerbear:** video costs 2 credits per output second (rounded up), plus 1 base credit per render; 60 fps doubles the cost. Plans: $49/mo (1,000 credits), $149 (10,000; one source says 5,000 **[conflict]**), $299 (50,000). Trial: 30 credits — [Bannerbear pricing](https://bannerbear.com/pricing); [Bannerbear API credits help](https://www.bannerbear.com/help/articles/203-what-are-api-credits)
- **Placid:** about 1 credit per video second. Basic $19/mo (500 credits), Pro $39 (2,500), Business $89 (25,000), VIP $249 (100,000) — [TrustRadius Placid](https://www.trustradius.com/products/placid.app) [3rd-party]
- **Plainly:** Starter $69/mo, or $48/mo annually (50 video minutes, 2 concurrent renders) [3rd-party]; the official page snippet shows 25 minutes on the entry plan **[conflict]**. 14-day trial. Vendr median buyer spend is $62,763/yr — [Plainly pricing](https://www.plainlyvideos.com/pricing); [Vendr](https://www.vendr.com/marketplace/plainly)
- **Mux / api.video (hosting, not composition):** encoding is free. Mux storage is about $0.0024–0.003/min, delivery about $0.0008–0.0032/min, with 100k free delivery minutes per month. api.video storage is about $0.00285/min and delivery about $0.0017/min; its sandbox allows 30-s clips, adds a watermark and deletes after 24 h — [Mux pricing docs](https://www.mux.com/docs/pricing/video); [toolradar api.video](https://toolradar.com/tools/api-video/pricing) [3rd-party, conflicting]
- **Adobe Express Embed SDK:** no cost once business access is approved — [Adobe Embed SDK](https://developer.adobe.com/embed-sdk)

### Inferences
- Pricing anchor for PixReel: a free tier larger than JSON2Video's (e.g., ≥10 min/month, 1080p, no watermark or a light one) plus a paid plan of about $9–19/mo for 100–300 min (≈$0.05–0.10/min). That would undercut Shotstack/Creatomate per minute, which ffmpeg-only rendering on cheap CPU can support.
- Per-second billing (Shotstack, Placid, Bannerbear) is the market norm, so meter by output seconds × resolution tier (as Creatomate does by resolution/fps).

### Gaps
- I could not fetch official pricing pages directly, so all plan prices need manual verification. Plan names/prices for Cloudinary video (credit-based) were not researched in detail.

## 5. Rate limits, max duration, SDKs, OpenAPI

### Takeaway
Shotstack publishes concrete rate limits (300 render requests/min in prod). Most others gate concurrency by plan (Plainly 2 concurrent renders on Starter). Max duration on free tiers is about 1 min (JSON2Video) or 30 s (api.video sandbox).

### Cited Findings
- Shotstack limits per API key per 60 s: Edit (render) 300 prod / 150 sandbox; Serve 600 / 300; Ingest 300 / 120. Exceeding them returns HTTP 429, and the docs advise exponential backoff — [Shotstack limitations](https://shotstack.io/docs/guide/architecting-an-application/limitations.md)
- JSON2Video free: max 1-minute video — [wireflow](https://www.wireflow.ai/blog/json2video-pricing) [3rd-party]
- Rendi: free tier has a 1-minute max ffmpeg command runtime, Pro 10 minutes — [Rendi pricing](https://www.rendi.dev/pricing)
- Plainly Starter: 2 concurrent renders [3rd-party] — [Capterra Plainly](https://www.capterra.com/p/10026817/Plainly/)

### Inferences
- PixReel's published OpenAPI spec is a selling point. It enables generated SDKs (Swift via swift-openapi-generator, Kotlin, TS, Python) and listing on apis.io / RapidAPI.

### Gaps
- I did not verify SDK languages (official Shotstack SDKs reportedly exist for Node/PHP/Python/Ruby, but that comes from training knowledge, not a source here) or OpenAPI availability for each vendor. No source confirmed native Swift/Kotlin SDKs for any competitor.

## 6. Open-source tools: licensing and status

### Takeaway
Everything except Remotion is MIT. Remotion is source-available and needs a paid company license for orgs of 4+. Editly, ffmpeg-concat, FFCreator and Motion Canvas have had no release since 2022–2024 (effectively stale). Remotion (release Nov 2026) and Revideo (Jul 2026) are active.

### Cited Findings (stars from GitHub pages; versions/dates from npm/PyPI registries, fetched 2026-11-05)
| Project | Stars | License | Latest version (date) | Notes |
|---|---|---|---|---|
| Remotion | 70.9k | Remotion License ("SEE LICENSE IN LICENSE.md"; company license required in some cases) | 4.0.540 (2026-11-02) | [GitHub](https://github.com/remotion-dev/remotion), [npm](https://registry.npmjs.org/remotion) |
| Motion Canvas | 19.7k | MIT | @motion-canvas/core 3.17.2 (2024-12-14) | [GitHub](https://github.com/motion-canvas/motion-canvas), [npm](https://registry.npmjs.org/@motion-canvas/core) |
| MoviePy (Python) | 15.1k | MIT | 2.2.1 (2025-05-21) | v1 unmaintained; README asks for maintainer help — [GitHub](https://github.com/Zulko/moviepy), [PyPI](https://pypi.org/pypi/moviepy/json) |
| Editly | 5.6k | MIT | 0.14.2 (2022-12-23) | [GitHub](https://github.com/mifi/editly), [npm](https://registry.npmjs.org/editly) |
| Revideo | 4.2k | MIT | @revideo/core 0.11.0 (2026-07-10) | repo now shown as midrender/revideo; headless `renderVideo()`, runs on Cloud Run — [GitHub](https://github.com/redotvideo/revideo), [npm](https://registry.npmjs.org/@revideo/core) |
| FFCreator | 3.2k | MIT | 7.5.8 (2024-07-27) | [GitHub](https://github.com/tnfe/FFCreator), [npm](https://registry.npmjs.org/ffcreator) |
| ffmpeg-concat | 991 | MIT | 1.3.0 (2022-10-15) | Travis CI badge, Node 10.13+ — [GitHub](https://github.com/transitive-bullshit/ffmpeg-concat), [npm](https://registry.npmjs.org/ffmpeg-concat) |

- Remotion: companies of 4+ people need a paid license. Automators pricing is $0.01/render, min $100/mo — [Remotion license FAQ](https://www.remotion.dev/docs/license/faq); [Remotion pricing](https://www.remotion.dev/docs/license/pricing)

### Inferences
- If PixReel wraps an OSS tool, MIT libraries (Editly/FFCreator) carry no license cost, but they are stale. Building directly on ffmpeg (as PixReel does) avoids both licensing and maintenance risk. Note that ffmpeg builds with libx264/x265 are GPL. Offering a hosted API is not "distribution" under the GPL, but shipping ffmpeg inside the iOS/Android/desktop apps would trigger GPL/LGPL obligations (a general licensing point, not sourced here).

### Gaps
- GitHub API access was blocked, so "last commit" dates are unknown. Release dates come from package registries.

## 7. Hosting options for a free/cheap self-hosted ffmpeg API

### Takeaway
HF Spaces CPU Basic (2 vCPU / 16 GB / 50 GB ephemeral disk, sleeps when idle) is the most generous free tier for CPU ffmpeg, but its 2026 free-creation status is disputed. Oracle Always Free Ampere (4 OCPU / 24 GB, if not reduced) is the best always-on VM. Cloud Run's free 180k vCPU-s/month covers about 50 vCPU-hours. Render's free tier (0.1 vCPU / 512 MB, sleeps after 15 min) is too small for 4K. Fly.io has no clear free tier.

### Cited Findings
- HF Spaces CPU Basic: 2 vCPU, 16 GB RAM, 50 GB non-persistent disk, free. Sleeps after inactivity (48 h per the hardware page). The sleep timer is customizable only on paid hardware — [HF Spaces overview](https://huggingface.co/docs/hub/spaces-overview); [HF Spaces GPUs/hardware](https://huggingface.co/docs/hub/en/spaces-gpus). **[conflict]** One official overview page says Docker/Gradio Spaces need a paid plan to create — [HF Spaces overview (en)](https://huggingface.co/docs/hub/en/spaces-overview). A 60-s request timeout and 30–60 s cold starts are reported only by unofficial docs — [HuggingRun HF_LIMITATIONS](https://huggingface.co/spaces/nikhtu10/HuggingRun/blob/main/docs/HF_LIMITATIONS.md) [unverified]
- Google Cloud Run always-free: 2M requests, 180,000 vCPU-seconds and 360,000 GB-seconds per month, card required, plus $300/90-day trial credit — [flaviocopes free tiers, Sept 2026](https://flaviocopes.com/hosting-free-tiers/) [3rd-party]; [publicapis.dev](https://publicapis.dev/blog/free-api-hosting) [3rd-party]
- Render free web service: 0.1 vCPU / 512 MB, sleeps after 15 min idle. Free bandwidth reportedly cut from 100 GB to 5 GB in April 2026 — [flaviocopes](https://flaviocopes.com/hosting-free-tiers/); [Render article](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026.md)
- Fly.io: **[conflict]**. Sources variously say free allowances ended Oct 2024, that there is a $5 monthly credit, or that a trial-only plan exists — [costbench Fly.io](https://costbench.com/software/cloud-infrastructure/fly-io/free-plan/); [flaviocopes](https://flaviocopes.com/hosting-free-tiers/)
- Oracle Always Free Ampere A1: 4 Arm OCPU, 24 GB RAM, 200 GB block storage, no expiry. One snapshot claims the Arm allowance was halved in June 2026 **[unverified]** — [snapdeploy state of free hosting](https://snapdeploy.dev/state-of-free-hosting); [spokes-wiki Oracle](https://spokes-wiki.pages.dev/cloud-wiki/oracle-cloud-free) [3rd-party]

### Inferences
- At an estimated 1–3 vCPU-minutes per 1080p output minute with x264 veryfast (rough estimate, not sourced), Cloud Run's free allowance gives roughly 1,000–3,000 free output minutes/month. HF Spaces offers unmetered 2 vCPU but has sleep/cold-start problems and possibly HTTP timeouts. That suits async jobs with polling, but `/v1/convert` sync calls on long 4K renders may hit timeouts.
- HF Spaces ToS/fair-use for running a public commercial API backend should be checked before offering it to third parties.

### Gaps
- No official 2026 pricing pages were fetched for Cloud Run, Oracle, Fly.io or Render. HF request timeout limits are unverified. No benchmark of ffmpeg throughput on these free tiers was found.
