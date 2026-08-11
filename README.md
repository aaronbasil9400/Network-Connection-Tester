# NetVitals

A static, mobile-first browser diagnostic for internet reachability, latency, jitter, application-layer request loss, adaptive download/upload testing, browser-visible network information, device information and connection security signals.

## Recommended production stack

**GitHub → Cloudflare Pages → custom domain → Google AdSense.**

For this project, static hosting is the best performance/cost fit because the diagnostic runs in the visitor's browser. Cloudflare Pages can serve the HTML/CSS/JS globally over HTTPS without a VPS or application server. Keep the site static until you have a genuine server-side requirement.

## Project structure

```text
netvitals-site/
├── index.html
├── about/
├── how-it-works/
├── privacy/
├── terms/
├── contact/
├── guides/
├── assets/
│   ├── css/site.css
│   ├── js/app.js
│   ├── js/metrics.js
│   ├── js/config.js
│   ├── js/ads.js
│   ├── js/pwa.js
│   └── icons/
├── manifest.webmanifest
├── service-worker.js
├── ping.txt
├── tests/
├── robots.txt
├── sitemap.xml
├── ads.txt
└── README.md
```

## Before your first public deployment

1. Point `netvitals.net` at the production host and enforce HTTPS.
2. Create and monitor `contact@netvitals.net` and `privacy@netvitals.net`, or replace them site-wide.
3. Review the Privacy Policy and Terms for your actual jurisdiction and business. They are not legal advice.
4. Keep ads enabled only after your AdSense site setup is approved and privacy messaging is configured.

A useful AdSense placeholder check before committing:

```bash
rg "YOUR_PUBLISHER_ID|YOUR_OPTIONAL_AD_UNIT_ID" .
```

The command should return no results after the real AdSense values are configured.

# Hosting with Cloudflare Pages

## 1. Create a GitHub repository

Create an empty repository, then from this project folder:

```bash
git init
git add .
git commit -m "Initial NetVitals website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

## 2. Create the Pages site

In Cloudflare, create a Pages/Workers & Pages project and connect the GitHub repository. For this plain static site there is no framework build step: use the repository root as the deployed static content. If Cloudflare's current UI asks for a build command, leave it blank when supported; the output directory should be the directory containing `index.html`.

Cloudflare documentation: https://developers.cloudflare.com/pages/

## 3. Add your custom domain

In the Pages project, add your domain under **Custom domains** and follow Cloudflare's DNS instructions. Verify that both your chosen canonical hostname and HTTPS work. Redirect the non-canonical hostname (for example `www`) to the canonical hostname if you only want one indexed version.

Cloudflare custom-domain documentation: https://developers.cloudflare.com/pages/configuration/custom-domains/

## 4. Validate production

Check these URLs after deployment:

```text
https://netvitals.net/
https://netvitals.net/manifest.webmanifest
https://netvitals.net/service-worker.js
https://netvitals.net/ping.txt
https://netvitals.net/robots.txt
https://netvitals.net/sitemap.xml
https://netvitals.net/ads.txt
```

Also run both Quick Check and Full Diagnostic on iPhone Safari, Android Chrome, desktop Chrome/Edge/Firefox and macOS Safari when available. Browser APIs vary, so "Unavailable" for restricted APIs such as battery/network details can be expected.

# PWA / Add to Home Screen

The project includes a web app manifest, icons and a service worker. On supported browsers it can be installed as a standalone web app. On iPhone, open the production HTTPS site in Safari and use **Share → Add to Home Screen**.

The service worker caches same-origin static assets but explicitly bypasses `/ping.txt`, so latency probes always use the network. External service and speed-test requests are not intercepted.

# Google Search setup

1. Add the production domain to Google Search Console.
2. Verify ownership using one of Google's supported methods.
3. Submit `https://netvitals.net/sitemap.xml`.
4. Confirm `robots.txt` does not block the pages you want indexed.
5. Request indexing for the homepage after launch.

Official sitemap documentation: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

# Monetization with Google AdSense

## Important: approval comes before real ad deployment

Google reviews the site before it can serve AdSense ads. A site should be live, reachable without a password, contain original useful content, comply with AdSense policies, and have a clear user experience. The included educational pages are a foundation; continue improving them rather than creating large amounts of thin content.

Official site connection/review guide: https://support.google.com/adsense/answer/7584263

## Recommended order

### 1. Launch without ads

Publish the site with:

```js
enableAds: false
```

Build real usage, fix bugs, make the informational pages complete, and ensure the site is useful independently of advertising.

### 2. Create/configure AdSense

In AdSense, add the production domain under **Sites**. Google currently supports verification methods including an AdSense code snippet, an `ads.txt` line, or a meta tag depending on the setup presented in your account. Follow the exact current instructions in your AdSense dashboard.

Google says site review usually takes a few days but can sometimes take 2–4 weeks. Do not repeatedly remove and re-add the site just because review is pending.

### 3. Privacy and consent

Before serving ads, make your privacy disclosures accurate. Google requires publisher privacy policies to disclose Google's/third parties' use of advertising cookies and personalized-ad controls.

Official required-content guidance: https://support.google.com/adsense/answer/1348695

For visitors in the EEA, UK and Switzerland, configure Google **Privacy & messaging** or another Google-certified CMP as required by Google's EU user-consent policy. Do not replace a real CMP with a cosmetic home-made cookie banner.

Official CMP guidance: https://support.google.com/adsense/answer/7670013

### 4. Configure `ads.txt`

The production `/ads.txt` entry is configured for the current publisher ID:

```text
google.com, pub-4936629245103906, DIRECT, f08c47fec0942fa0
```

Use the value shown in your own AdSense account rather than copying an example publisher ID.

### 5. Enable ad loading in this project

Edit `assets/js/config.js`:

```js
window.NETVITALS_CONFIG = Object.freeze({
  siteName: "NetVitals",
  siteUrl: "https://netvitals.net",
  adsenseClient: "ca-pub-4936629245103906",
  adsenseSlot: "YOUR_OPTIONAL_AD_UNIT_ID",
  enableAds: true
});
```

Google's Auto ads script is included once in the `<head>` of every HTML page. The included `assets/js/ads.js` handles only optional manual units: the homepage's responsive unit is initialized when `adsenseSlot` is a numeric ad-unit ID; otherwise its container remains hidden.

### 6. Ad placement strategy

Start conservatively. This template has responsive slots positioned away from the diagnostic action buttons. Do not make ads look like controls, do not encourage clicks, and do not let ads crowd the main diagnostic result. A clean utility that users trust is more valuable than maximizing ad density.

You may prefer AdSense Auto ads after approval, or manual units if you want exact placement. Follow the current AdSense interface and policies because ad implementation options can change.

## Monetization roadmap

A sensible progression is:

```text
Useful free diagnostic
        ↓
Search-indexed educational content
        ↓
AdSense after approval
        ↓
More high-quality troubleshooting guides
        ↓
Optional non-ad monetization later
```

Potential future revenue sources that do not require changing the core tool include sponsorship of educational content, affiliate links for relevant networking equipment (with clear disclosure), or a premium ad-free/server-side diagnostic product. Do not add these until you have real traffic and a clear user benefit.

# Performance guidance

Keep the core site static. Avoid introducing React/Next.js or a backend unless there is a concrete feature that needs them. The current architecture offers:

- minimal server cost;
- CDN-friendly files;
- very little server-side attack surface;
- fast first load;
- simple Git-based deployments.

If traffic grows, optimize images, use long cache headers for versioned assets, and consider moving large third-party functionality behind explicit user actions. The speed-test transfer itself is intentionally user-triggered because it can consume several megabytes.

# Testing locally

Run a local static server:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Browsers treat localhost as a trustworthy development context for many secure-context APIs, but production should always use HTTPS.

Run the dependency-free automated checks with Node.js and Python:

```bash
node --test tests/app.test.js tests/metrics.test.js
python tests/validate_site.py
```

## Pre-deployment checks

- Homepage loads without console-breaking errors.
- Quick Check completes.
- Full Diagnostic completes or gracefully reports blocked third-party requests.
- Layout works at 320, 350, 375, 390, 430, 768 and 1024+ px widths.
- Navigation pages return HTTP 200.
- `manifest.webmanifest` parses as JSON.
- Service worker registers on HTTPS/localhost.
- Production DevTools shows each `ping.txt` probe transferred from the network, never from the service worker, memory cache or disk cache.
- No duplicate HTML IDs.
- No placeholder domains or email addresses remain in production.
- `sitemap.xml` uses the real canonical domain.
- `robots.txt` points to the real sitemap.
- `ads.txt` contains your real publisher entry only when AdSense supplies it.
- AdSense uses publisher `ca-pub-4936629245103906` and is enabled only when the account/site setup is ready.

# Updating the site

After making a change:

```bash
git add .
git commit -m "Describe the change"
git push
```

With GitHub connected to Cloudflare Pages, Cloudflare will deploy the commit automatically.

When changing the homepage CSS or diagnostic JavaScript, bump the shared `?v=` asset query and the service worker `CACHE` version together so existing browsers cannot mix old and new files during rollout.

# Diagnostic accuracy notes

- Latency is the median successful timing from sequential requests to the same-origin `/ping.txt` endpoint. It is a browser HTTP RTT approximation, not ICMP ping.
- Jitter is the mean absolute difference between consecutive successful timings from that dedicated probe sequence.
- Request loss is the share of measured `/ping.txt` requests that fail. It is an application-layer estimate, not raw packet loss.
- Configured service checks run separately and never contribute timings or failures to latency, jitter or request loss.
- Throughput depends on the remote test endpoint and browser behavior.
- Safari may hide battery, memory and network-type information.
- The security score is a browser-visible signal score, not a network penetration test.

# License / ownership

NetVitals was developed by Aaron Basil Raj. Add the license you want before making the repository public. If you want to keep commercial reuse restricted, do not automatically add an open-source license without understanding its terms.
