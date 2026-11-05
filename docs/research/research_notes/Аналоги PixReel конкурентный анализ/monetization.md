# Monetization models for a free, privacy-first, client-side media tool (PixReel)

All sources accessed 2026-11-05. Method note: WebFetch could not resolve indiehackers.com, photopea.com or kod.ru from this session (network allowlist), so several facts rest on search-result snippets and secondary or aggregator pages. Each such case is marked. Items marked **[unverified / background knowledge]** come from the researcher's prior knowledge and have no fetched source. Re-check them before putting them in a final report.

## 1. Case studies: how comparable free/browser tools make money

### Takeaway
The closest analogue to PixReel is Photopea: free, client-side, one developer. It earned about $3M in 2024 (self-reported), roughly 90% from display ads and the rest from an ad-free Premium tier and licensing. Tools that run on servers (remove.bg, TinyPNG, CloudConvert, iLovePDF) charge for compute through credits, per-call API pricing or subscriptions. Open-source canvas tools (Excalidraw, tldraw) earn from hosted collaboration or from commercial SDK licences. Video editors (Kapwing, Clideo) mostly use the watermark as the paywall, which PixReel has ruled out.

### Cited Findings
**Photopea (browser, client-side, solo developer)**
- 2024 revenue was reported at about $3M. The figure was disclosed May 9, 2025 and is self-reported, not audited. — [Indie Hackers](https://www.indiehackers.com/post/making-3m-per-year-with-a-free-product-axW4u1vB6C8f91Z3Lxu5) (search snippet only, page not fetched); [aiidelist profile](https://aiidelist.com/indie-developers/ivan-kutskir)
- Revenue mix: about 90% ads, the rest from Premium accounts and licensing/integration contracts (May 2025 interview, as summarised). — [aiidelist](https://aiidelist.com/indie-developers/ivan-kutskir); [Wikipedia](https://en.wikipedia.org/wiki/Photopea)
- Earlier figure: about $1M in 2020 (older data). — [Wikipedia](https://en.wikipedia.org/wiki/Photopea); [AIN.ua, 2021](https://en.ain.ua/2021/04/15/photopea-history)
- Premium price is disputed: $5/month or $40/year (tool directory) versus "$3.3/month" (2021 source). Not verified against photopea.com. — [Tiny Startups](https://tinystartups.com/tools/photopea); [AIN.ua 2021](https://en.ain.ua/2021/04/15/photopea-history)
- Medium claims about $100K/month in ad revenue. No source is given, so treat as unverified. — [Medium](https://medium.com/@uzmanali/this-guy-makes-1m-per-year-with-0-employees-e8d15021b625)

**ezgif.com (server-side GIF/video tool, ads only)**
- Shows standard display banners. A Setupad case study (vendor marketing) says ad-layout optimisation doubled ezgif's ad revenue. No absolute figures are given. — [Setupad case study](https://setupad.com/blog/ezgif-monetization-case-study-setupad/)
- The owner is hidden in WHOIS. — [MalwareTips scan](https://tools.malwaretips.com/url-scan/ezgif.com)

**Squoosh**
- A Google Chrome Labs open-source (Apache-2.0) client-side image compressor with no monetisation. It is funded as a showcase for the web platform, so it is not a business model PixReel can copy. **[unverified / background knowledge. No source fetched]**

**remove.bg (server AI, credits)**
- Pay-as-you-go credit packs (e.g. about $9 for 40 credits) plus a subscription (about $29/month for 200 credits). Credits expire after 2 years. API access comes with paid credits, and the free tier gives low-resolution previews. Aggregator data only, and inconsistent across aggregators. — [Toolradar](https://toolradar.com/tools/remove-bg/pricing); [CostBench](https://costbench.com/software/ai-media-apis/remove-bg-api/) (internally inconsistent)

**TinyPNG / Tinify (API + Web Pro)**
- API: first 500 compressions/month free, then $0.009 per image up to 10,000, then $0.002 per image. Billed monthly with no minimum, by card or PayPal. — [Tinify official API pricing](https://tinify.com/pricing/api)
- Web Pro is about $39/year per user (unlimited compressions, 75 MB per file). Web Free allows 20 images per session at 5 MB each. These are aggregator figures. — [Toolradar](https://toolradar.com/tools/tinypng/pricing); [G2](https://www.g2.com/products/tinypng/pricing)

**CloudConvert (credits = conversion minutes)**
- Free tier: 25 conversions per day. Paid one-time packages never expire. Subscriptions are "up to 50% cheaper" but credits do not roll over. A conversion costs at least 1 credit plus 1 per extra minute, and some types have a 2-credit minimum. — [CloudConvert pricing](https://cloudconvert.com/pricing)
- Approximate price is about $8–9 for 500 minutes (third-party). — [Capterra UK](https://www.capterra.co.uk/software/157495/cloudconvert); [cococonvert comparison](https://cococonvert.com/blog/cococonvert-vs-cloudconvert)

**iLovePDF / Smallpdf (freemium SaaS)**
- iLovePDF started on ads and moved to freemium subscriptions aimed at businesses and heavy users (Ara, Nov 2024). — [Ara.cat](https://es.ara.cat/economia/empresas/herramienta-fusionar-dividir-pdfs-catalana-no-sabias_1_5189095.html)
- iLovePDF Premium is about $5/month billed annually ($60/year) or about $9/month billed monthly. It removes ads and removes processing limits. — [iLovePDF pricing (PL)](https://www.ilovepdf.com/pl/cena); [iLovePDF pricing (RU)](https://www.ilovepdf.com/ru/pricing)
- A LinkedIn post claims iLovePDF revenue passed €20M in 2024. Unverified, and it conflicts with directory estimates of $1–10M. — [LinkedIn](https://in.linkedin.com/in/abxrnt)
- Smallpdf starts at about $15/month (review site). No reliable revenue data was found. — [TrustRadius / review aggregators](https://www.trustradius.com/products/ilovepdf/reviews?q=Pdf+file)

**Excalidraw (MIT open source + hosted Excalidraw+)**
- Excalidraw+ costs $6 per user per month with a 14-day trial. It adds cloud saving, unlimited scenes and folders, access management and sharing. — [Excalidraw+ pricing (official)](https://plus.excalidraw.com/pricing)
- The core is MIT-licensed and can be self-hosted. The free app needs no signup. — [OpenTechHub](https://www.opentechhub.io/excalidraw-a-zero-friction-end-to-end-encrypted-whiteboard-that-respects-your-privacy-and-your-budget/)
- No revenue figures are public.

**tldraw (source-available SDK licensing)**
- From SDK 4.0 (Sept 2025), production use needs a licence key. Without one the SDK runs only in development mode. There is a 100-day free trial, commercial pricing comes from sales, and startups can get discounts. — [tldraw pricing](https://tldraw.dev/pricing); [tldraw license-key docs](https://tldraw.dev/sdk-features/license-key); [AlternativeTo news, 2025](https://alternativeto.net/news/2025/9/tldraw-sdk-4-0-adds-five-new-starter-kits-cli-tool-and-enforces-licensing-changes/)
- A third party reports about $6,000/year per team for a standard commercial licence. Unverified. — [Gappsy](https://gappsy.com/tools/tldraw/)
- Internal company use counts as commercial. — [tldraw license update blog](https://tldraw.dev/blog/license-update-for-the-tldraw-sdk)

**Kapwing (early model) and Clideo**
- Early Kapwing (about 2018, older data) added a paywall one month after launch and had 20+ subscribers paying about $240/month. — [Indie Hackers interview](https://www.indiehackers.com/interview/channeling-our-love-of-social-media-into-a-profitable-business-17b24e043e) (snippet)
- Kapwing's free plan watermarks every export, and Pro removes the watermark. — [Kapwing watermark policy](https://www.kapwing.com/help/our-watermark-policy/)
- Kapwing paid plans are reported at $16–24/month and up. Sources conflict. — [Kapwing pricing](https://www.kapwing.com/pricing); [fluxnote 2026](https://fluxnote.io/guides/kapwing-pricing-breakdown-2026)
- Clideo is freemium: the free tier has a watermark and file limits (about 500 MB), and Premium unlocks watermark-free exports. Secondhand source. — [wildandfreetools](https://wildandfreetools.com/blog/kapwing-clideo-alternative-video-trimmer/); [wavel.ai](https://wavel.ai/compare/kapwing-vs-clideo)

### Inferences
- Photopea shows that a zero-signup, client-side tool can reach millions of dollars a year on ads, but only with very large traffic (reported as about 12M monthly users in an Indie Hackers headline: [IH](https://www.indiehackers.com/post/how-reddit-ama-earned-photopea-12m-monthly-users-7c66c1d9ad)). A cheap "remove ads" tier works alongside the ads without breaking the free promise.
- Every server-side analogue meters compute: credits, minutes or images. This fits PixReel's planned FastAPI/ffmpeg API for RAW, HEIC, PSD and PDF.
- PixReel has no watermark, so the usual video-editor paywall is not available. It has to charge for capacity, convenience, cloud features or the API.

### Gaps
- Photopea's primary posts (Reddit AMA, the IH article) could not be fetched. The exact Premium price and ad network are unverified.
- No revenue figures exist for Excalidraw+, tldraw, Smallpdf, Clideo or ezgif.
- Squoosh details come only from background knowledge.

## 2. Freemium levers that keep the "no watermark" promise

### Takeaway
The levers peers already use without watermarks are: ad-free tiers (Photopea, iLovePDF), per-session or file-size limits (TinyPNG Web Free: 20 images, 5 MB), daily quotas (CloudConvert: 25/day), batch and size caps (iLovePDF), cloud save and sharing (Excalidraw+), metered API (Tinify, remove.bg, CloudConvert) and commercial SDK licensing (tldraw). Display-ad RPMs for general or utility content sit around $5–20, with large uncertainty.

### Cited Findings
- Limits on session size and file size are TinyPNG's main free-versus-Pro lever. — [Toolradar TinyPNG](https://toolradar.com/tools/tinypng/pricing)
- Daily quota (25 conversions/day) as the free lever, with prepaid non-expiring packages as an option. — [CloudConvert pricing](https://cloudconvert.com/pricing)
- Cloud save, sharing and access control as the paid layer over a free open-source editor ($6/user/month). — [Excalidraw+ pricing](https://plus.excalidraw.com/pricing)
- Ad-free plus unlimited processing as Premium (about $5/month annual). — [iLovePDF pricing](https://www.ilovepdf.com/pl/cena)
- Display-ad RPM estimates (third-party calculators, low reliability): AdSense about $5–15, Mediavine about $15–30, Raptive about $20–40. Ezoic is said to be 50–100% above AdSense. General content earns about $5–20 RPM, finance/B2B about $15–50. — [ecomcalctools](https://ecomcalctools.com/publisher/website-ad-revenue-calculator/); [toolbox estimator](https://toolbox-5pu.pages.dev/calculator-tools/ad-revenue-estimator/)
- Network entry thresholds: Raptive needs 100K pageviews/month and pays publishers 75% of display revenue. Mediavine needs 50K sessions/month. Ezoic pays 90%+ (tiered). Third-party data. — [xpay.sh comparison](https://www.xpay.sh/publishers/compare/raptive-vs-ezoic); [ecomcalctools](https://ecomcalctools.com/publisher/)
- Raptive itself claims RPM rose 5% with 27% fewer ads in 2025. This is vendor marketing. — [Raptive](https://raptive.com/reach-your-full-potential-with-raptive/)
- Ad-layout optimisation doubled ezgif's ad revenue (vendor case study). — [Setupad](https://setupad.com/blog/ezgif-monetization-case-study-setupad/)

### Inferences
- Tool sites have long sessions in one app view and few pageviews. RPM should therefore be measured per session or per hour, not per pageview. Photopea-style in-app banners are the reference model.
- Russian-speaking traffic will have much lower RPM than US/EU traffic, and Western ad networks have limited reach in Russia, where Yandex Advertising Network (РСЯ) is the realistic option. **[unverified. No RPM data found]**
- Levers that fit PixReel and keep the promise:
  - free browser tier, unlimited and without a watermark
  - "Pro" with batch projects, premium templates and transitions, saved projects or cloud share links, and an ad-free mode
  - server credits for heavy formats and priority server rendering
  - API tiers
  - one-time purchase for desktop/mobile apps
  - donations (GitHub Sponsors / Open Collective / Boosty for Russian speakers)
  - stock-music affiliate links

### Gaps
- No primary-source RPM data was found for tool or utility sites, and none for Russian (РСЯ) traffic.
- No public conversion rates (free to paid) were found for peers. Donation revenue benchmarks for client-side tools (GitHub Sponsors / Open Collective) were not researched because of the tool-call budget.
- Stock-music affiliate programmes (Epidemic Sound, Artlist) and their commission rates were not researched.

## 3. Costs: server rendering, storage/egress, music licensing

### Takeaway
No trustworthy primary figure for CPU cost per minute of ffmpeg 1080p encoding turned up. Managed transcoding (AWS MediaConvert) costs about $0.017–0.024 per output minute at 1080p, an upper bound that self-hosted ffmpeg should beat. PixReel should benchmark its own workload. Pixabay Music allows free commercial use in videos without attribution, but Content ID claims can still appear on YouTube.

### Cited Findings
- AWS MediaConvert 1080p costs about $0.017–0.024 per output minute (secondary source, 2024). — [BlazingCDN](https://blog.blazingcdn.com/en-us/cdn/top-6-video-decoding-services-2024)
- A 2020 benchmark put cloud encoding at about $0.01/min. This is older data. — [MSU benchmark 2020](https://compression.ru/video/codec_comparison/cloud_2020)
- Graviton was the cheapest AWS CPU per hour for x264 at 1080p. Running several encodes in parallel per instance cuts cost per stream sharply. — [Streaming Learning Center](https://streaminglearningcenter.com/codecs/best-aws-cpu-for-ffmpeg.html); [NETINT](https://netint.com/?p=5652)
- Method: cost per encoded minute = instance $/hour ÷ minutes encoded per hour. — [DEV Community](https://dev.to/masonwritescode/benchmark-nvenc-vs-cpu-transcoding-and-find-your-real-break-even-with-ffmpeg-5gg5)
- Pixabay content is free for commercial and non-commercial use. Music can be used in videos and social media without attribution. — [Pixabay License Summary](https://pixabay.com/en/service/license/); [Pixabay FAQ](https://pixabay.com/service/faq/)
- Many Pixabay composers register tracks in Content ID. Pixabay provides a licence certificate to dispute claims, but it cannot clear claims with YouTube itself. — [Pixabay FAQ](https://pixabay.com/service/faq/); [Thematic, competitor marketing](https://hellothematic.com/thematic-vs-pixabay/)
- Pixabay's licence forbids selling or distributing content on a standalone basis, which matters when building a music library into an app. **[unverified / background knowledge. Read the full licence text before embedding a library]**
- YouTube Audio Library tracks are licensed mainly for use in YouTube videos, so redistributing them inside a third-party app is doubtful. Free Music Archive tracks each carry their own Creative Commons licence, and many are NC (non-commercial). **[unverified / background knowledge]**

### Inferences
- For PixReel, client-side rendering means near-zero marginal cost for the core product. The server API is the only meaningful variable cost, so pricing it in credits per minute or per file (the CloudConvert model) maps cost straight to revenue.
- A built-in music library is the main legal risk. The safest route is music you commission or own, CC0 tracks, or a "bring your own music" approach plus affiliate links, rather than redistributing Pixabay or YouTube tracks inside the app.

### Gaps
- No reliable $/minute figure for self-hosted CPU encoding. Benchmark on the actual target VPS (e.g. Hetzner) and on RAW/HEIC/PSD decode workloads.
- Storage and egress pricing (S3, R2, Hetzner) was not researched within budget. Cloudflare R2 has zero egress fees. **[background knowledge, unverified]**

## 4. Payment acceptance: Russia (2026) and global

### Takeaway
Russia: Google Play stopped paying Russian developers in January 2025. The App Store does not accept Russian cards, and Apple has reportedly allowed external purchase links for Russia (details unconfirmed). RuStore charges 15% but shut off its payment SDK for self-employed developers from Feb 1, 2026. For the web, Russian acquirers (YooKassa, CloudPayments, Prodamus) are the realistic option, with rates negotiated individually (about 2.6%+). Global: Paddle and Lemon Squeezy (both merchants of record) charge about 5% + $0.50. Stripe owns Lemon Squeezy and is moving it toward Stripe Managed Payments, whose pricing is unclear.

### Cited Findings
- Google Play's last payout to Russian developers was planned for Jan 15, 2025. Purchases of their paid apps and subscriptions are declined. — [www1.ru, Dec 2024](https://www1.ru/en/news/2024/12/28/google-play-priostanavlivaet-vyplaty-razrabotcikam-iz-rossii.html)
- App Store still works in Russia, but Russian bank cards cannot be used for direct payment. — [RuWiki App Store](https://ru.ruwiki.ru/wiki/App_Store)
- Apple reportedly allows Russian developers to link to external payment through the StoreKit External Purchase Link Entitlement (reported Aug 2026). Details are unconfirmed and the article could not be fetched. — [kod.ru](https://kod.ru/apple-razreshila-oplatu-vne-app-store-v-rossii); [mobile-review](https://mobile-review.com/all/news/apple-pozvolit-razrabotchikam-iz-rossii-osushhestvlyat-priyom-platezhej-v-magazine-app-store-cherez-vneshnie-resursy/); [Snob](https://snob.ru/news/apple-razreshit-rossiyanam-sovershat-pokupki-v-prilozheniyah-v-obhod-appstore/)
- Background: in 2022 Russia's competition regulator (ФАС) found Apple imposed its payment system and banned telling users about outside payment. Apple paid a 1.2bn RUB fine on Jan 18, 2024. — [mobile-review](https://mobile-review.com/all/?p=124781); [Kommersant](https://kommersant.ru/doc/6465280)
- RuStore charges 15% on transactions (2023 launch data) using billing built by Sber. — [Habr](https://habr.com/ru/news/740334); [rozetked](https://rozetked.me/news/25263-v-otechestvennom-magazine-prilozheniy-rustore-poyavilas-podderzhka-platnyh-podpisok-i-razovyh-pokupok)
- RuStore stopped taking new monetisation applications from self-employed developers on Dec 12, 2025 and turns off its payment tools for them from Feb 1, 2026. Ads and non-SDK payments remain allowed, with no commission on alternative payments. — [blog source](https://xn--80aapgyievp4gwb.xn--p1ai/blog/rustore-otmenyaet-monetizaciyu-samozanyatym)
- RuStore has been mandatory for pre-installation on Apple and Xiaomi devices sold in Russia since Sept 1, 2025. — same source as above
- Prodamus is available to self-employed people, individual entrepreneurs and companies registered in Russia, with connection "from 1 ₽". Commission is quoted on request (Prodamus' own vc.ru post, which is promotional). — [vc.ru](https://vc.ru/services/2657267-prodamus-platezhnyj-modul-dlya-samozanyatyh-i-ip)
- CloudPayments' public calculator example is 2.6%, with the actual rate set by contract. YooKassa is operated by НКО «ЮМани» under Bank of Russia licence 3510-К. — [toolfox CloudPayments](https://toolfox.ru/services/s/cloudpayments/alternatives); [toolfox YooKassa](https://toolfox.ru/services/s/yookassa/alternatives)
- Paddle and Lemon Squeezy both charge about 5% + 50¢ as merchant of record. Paddle covers 200+ tax jurisdictions and offers custom rates at volume. — [Dodo Payments, competitor](https://dodopayments.com/blogs/paddle-vs-lemon-squeezy/); [Rework](https://resources.rework.com/tools/billing-revenue/paddle-vs-lemon-squeezy)
- Stripe acquired Lemon Squeezy in 2024. Stripe Managed Payments (merchant of record) pricing is reported variously as +3.5% on top of processing or 6.4% + $0.30 (preview), covering 80+ countries. Sources conflict. — [UserJot](https://userjot.com/blog/stripe-managed-payments-for-saas); [DEV fee comparison 2026](https://dev.to/jettfu/stripe-vs-paddle-vs-lemon-squeezy-fee-comparison-2026-2c77)

### Inferences
- A practical split is a Russian acquirer (Prodamus/CloudPayments/YooKassa, through a self-employed status or individual entrepreneur registration) for RUB web payments, plus a merchant of record (Paddle) for global web payments. Merchants of record generally do not serve Russian buyers or sellers under sanctions. **[unverified. Check the Paddle and Lemon Squeezy restricted-countries lists]**
- For mobile, prefer web-based purchases for both markets. Licence unlocks on the web, with in-app purchases only where they work. The RuStore self-employed ban means registering as an individual entrepreneur (ИП) if RuStore billing is needed.
- Sanctions and payment rules change fast. Every Russia-related fact here needs re-checking at launch.

### Gaps
- Official 2026 rate cards for YooKassa, CloudPayments and Prodamus were not found.
- Current Apple payout status for Russian developers, and the exact terms of the 2026 external-link permission, are unconfirmed.
- Current RuStore commission for 2026 is unconfirmed (only 2023 data found).

## 5. Open-source licensing strategy (MIT vs AGPL vs open-core)

### Takeaway
Comparable tools show three paths:
- **MIT core with paid hosted extras** (Excalidraw: the community grows freely and money comes from cloud and team features).
- **Source-available or commercial licence for production** (tldraw 4.0: strong licensing revenue, at the cost of community goodwill).
- **AGPL plus a commercial dual licence** (small tools like Hyper Compress and UAParser.js). AGPL blocks a competitor from re-hosting the tool as a closed SaaS, but it puts off indie adopters and needs a CLA for dual licensing.

No rigorous revenue data exists for small dual-licensed projects.

### Cited Findings
- Excalidraw: MIT core with a paid hosted Excalidraw+. — [Excalidraw+ pricing](https://plus.excalidraw.com/pricing); [OpenTechHub](https://www.opentechhub.io/excalidraw-a-zero-friction-end-to-end-encrypted-whiteboard-that-respects-your-privacy-and-your-budget/)
- tldraw: licence key required in production since 4.0. Commercial licences remove the "Made with tldraw" watermark. — [tldraw license key](https://tldraw.dev/sdk-features/license-key); [tldraw blog](https://tldraw.dev/blog/license-update-for-the-tldraw-sdk)
- Hyper Compress (PDF engine): AGPL-3.0 for self-hosting, with a commercial licence for proprietary use or SaaS without AGPL obligations. — [Hyper Compress docs](https://hyper.bentopdf.com/docs/licensing)
- UAParser.js v2 moved to AGPLv3 plus a paid PRO licence. Users were confused and trust suffered because the change was poorly communicated. — [GitHub issue #680](https://redirect.github.com/faisalman/ua-parser-js/issues/680)
- Replyke moved away from AGPL because it put off indie developers ("people stop reading when they see AGPL"). — [DEV Community](https://dev.to/tsabary/from-agpl-30-to-apache-20-why-ive-changed-the-license-on-90-of-my-project-4jfo)
- AGPL has become a common choice for commercial open-source application companies. Dual licensing usually relies on a contributor licence agreement (CLA). — [Heather Meeker](https://heathermeeker.com/author/heatherjmeeker/page/5/)
- Photopea is closed source but sells licensing and integrations as part of its non-ad revenue. — [aiidelist](https://aiidelist.com/indie-developers/ivan-kutskir)

### Inferences
- PixReel's money is likely to come from the server API, cloud and Pro features, and native apps, not from the browser code. A permissive or MIT front end helps trust ("privacy-first, verifiable"), SEO and contributions. The server API and native apps can stay closed, or the API can be AGPL with a commercial licence to deter competitors re-hosting it.
- If PixReel might ever sell an embeddable SDK (as tldraw does), choose AGPL or dual licensing from the start and require a CLA. Moving from MIT to a restrictive licence later damages goodwill, as the UAParser.js case shows.

### Gaps
- No published conversion or revenue data compares MIT and AGPL for small media tools.
- Excalidraw's revenue and the split between open-source and Plus users are not public.
