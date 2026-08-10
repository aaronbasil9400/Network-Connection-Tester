# Connection Health

A static, mobile-first browser diagnostic for internet reachability, latency, jitter, application-layer request loss, adaptive download/upload testing, browser-visible network information, device information and connection security signals.

## Recommended production stack

**GitHub → Cloudflare Pages → custom domain → Google AdSense.**

For this project, static hosting is the best performance/cost fit because the diagnostic runs in the visitor's browser. Cloudflare Pages can serve the HTML/CSS/JS globally over HTTPS without a VPS or application server. Keep the site static until you have a genuine server-side requirement.

## Project structure

```text
connection-health-site/
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
│   ├── js/config.js
│   ├── js/ads.js
│   ├── js/pwa.js
│   └── icons/
├── manifest.webmanifest
├── service-worker.js
├── robots.txt
├── sitemap.xml
├── ads.txt
└── README.md
```

## Before your first public deployment

1. Choose and buy your domain.
2. Search-and-replace **`https://example.com`** with your real canonical origin in `index.html`, all content pages, `robots.txt`, `sitemap.xml`, and `assets/js/config.js`.
3. Replace `contact@example.com` and `privacy@example.com` with addresses you monitor.
4. Review the Privacy Policy and Terms templates for your actual jurisdiction and business. They are starter content, not legal advice.
5. Keep `enableAds: false` until your AdSense setup is ready.

A useful check before committing:

```bash
grep -R "example.com" .
```

The command should return no placeholder production URLs after configuration.

# Hosting with Cloudflare Pages

## 1. Create a GitHub repository

Create an empty repository, then from this project folder:

```bash
git init
git add .
git commit -m "Initial Connection Health website"
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
https://YOUR_DOMAIN/
https://YOUR_DOMAIN/manifest.webmanifest
https://YOUR_DOMAIN/service-worker.js
https://YOUR_DOMAIN/robots.txt
https://YOUR_DOMAIN/sitemap.xml
https://YOUR_DOMAIN/ads.txt
```

Also run both Quick Check and Full Diagnostic on iPhone Safari, Android Chrome and a desktop browser. Browser APIs vary, so "Unavailable" for restricted APIs such as battery/network details can be expected.

# PWA / Add to Home Screen

The project includes a web app manifest, icons and a service worker. On supported browsers it can be installed as a standalone web app. On iPhone, open the production HTTPS site in Safari and use **Share → Add to Home Screen**.

The service worker caches only same-origin static assets. External diagnostic/speed-test requests are intentionally not intercepted.

# Google Search setup

1. Add the production domain to Google Search Console.
2. Verify ownership using one of Google's supported methods.
3. Submit `https://YOUR_DOMAIN/sitemap.xml`.
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

When AdSense gives you the exact publisher line, replace the placeholder in `/ads.txt`. A typical Google line looks like this format:

```text
google.com, pub-YOUR_PUBLISHER_ID, DIRECT, f08c47fec0942fa0
```

Use the value shown in your own AdSense account rather than copying an example publisher ID.

### 5. Enable ad loading in this project

Edit `assets/js/config.js`:

```js
window.CONNECTION_HEALTH_CONFIG = Object.freeze({
  siteName: "Connection Health",
  siteUrl: "https://YOUR_DOMAIN",
  adsenseClient: "ca-pub-YOUR_PUBLISHER_ID",
  enableAds: true
});
```

The included `assets/js/ads.js` will load Google's AdSense library only when `enableAds` is `true` and the publisher ID has the expected `ca-pub-...` form. Ad containers remain hidden when ads are disabled, so they do not leave large empty gaps before monetization.

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

## Pre-deployment checks

- Homepage loads without console-breaking errors.
- Quick Check completes.
- Full Diagnostic completes or gracefully reports blocked third-party requests.
- Layout works at 320 px, 375/390 px, tablet and desktop widths.
- Navigation pages return HTTP 200.
- `manifest.webmanifest` parses as JSON.
- Service worker registers on HTTPS/localhost.
- No duplicate HTML IDs.
- No `example.com`/placeholder emails remain in production.
- `sitemap.xml` uses the real canonical domain.
- `robots.txt` points to the real sitemap.
- `ads.txt` contains your real publisher entry only when AdSense supplies it.
- AdSense is disabled until your account/site setup is ready.

# Updating the site

After making a change:

```bash
git add .
git commit -m "Describe the change"
git push
```

With GitHub connected to Cloudflare Pages, Cloudflare will deploy the commit automatically.

# Diagnostic accuracy notes

- Latency is browser HTTP request timing, not ICMP ping.
- Request loss is an application-layer estimate, not raw packet loss.
- Jitter is calculated from browser request timing samples.
- Throughput depends on the remote test endpoint and browser behavior.
- Safari may hide battery, memory and network-type information.
- The security score is a browser-visible signal score, not a network penetration test.

# License / ownership

Add the license you want before making the repository public. If you want to keep commercial reuse restricted, do not automatically add an open-source license without understanding its terms.
