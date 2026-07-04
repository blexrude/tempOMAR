# Creative Wood Products — Website

A fast, responsive, single-page marketing website for **Creative Wood Products**,
a custom cabinetry & fine woodworking business. Built as plain HTML, CSS, and
JavaScript — no build step, no dependencies. It runs anywhere you can serve
static files.

## Files

| File | Purpose |
|------|---------|
| `index.html` | All page content and structure |
| `styles.css` | Styling (wood + forest-green palette drawn from the logo) |
| `script.js` | Mobile nav, footer year, contact-form validation |
| `assets/logo.png` | The Creative Wood Products logo |

## Preview locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Sections

Hero · Trust bar · Services · Portfolio · Process · About · Testimonials · Contact.

## Customizing (start here)

Most of what you'll want to change is real business info that's currently a
**placeholder**:

1. **Contact details** — in `index.html`, the `#contact` section and the footer:
   phone `(555) 010-0123`, email `hello@creativewoodproducts.com`, and the
   address `123 Main Street, Your Town`.
2. **Portfolio photos** — the gallery uses colored placeholder tiles. Replace each
   `<figure class="gallery-item">` block with a real photo, e.g.:
   ```html
   <figure class="gallery-item">
     <img src="assets/kitchen-1.jpg" alt="Farmhouse kitchen in painted maple" />
     <figcaption><strong>Farmhouse Kitchen</strong><span>Painted maple</span></figcaption>
   </figure>
   ```
   Put the image files in `assets/`.
3. **Testimonials** — swap in real client quotes and names in the `#testimonials` section.
4. **Copy & services** — edit any headings/paragraphs to match your voice and offerings.
5. **Colors** — tweak the CSS variables at the top of `styles.css` (`:root`).

## Make the contact form actually send

The form currently validates input and shows a demo confirmation (no email is
sent). To receive submissions, point it at a form service — e.g. [Formspree](https://formspree.io),
[Web3Forms](https://web3forms.com), or your own endpoint. Minimal approach:

```html
<!-- in index.html -->
<form class="contact-form" id="quoteForm" action="https://formspree.io/f/your-id" method="POST">
```

Then remove (or adjust) the `e.preventDefault()` submit handler in `script.js`
so the browser performs the real POST.

## Deploy (free options)

- **GitHub Pages** — push this repo and enable Pages (Settings → Pages → deploy from branch).
- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop the folder or connect the repo.

No configuration needed — it's a static site.
