# Deploying the Mealhub frontend

Target: **`https://mealhub.store`** — a static Vite build served directly by Apache,
talking to the API already live at `https://api.mealhub.store`.

There is no Node process in production. `npm run build` produces a folder of static files;
Apache serves them. Nothing to keep running, nothing to restart.

Assumes the same box, with Apache and certbot already set up. Copy-paste ready.

---

## The two things that break this deployment

Read these before you start — they cause the two failures people actually hit.

**1. Environment variables are baked in at build time.** Vite *inlines* every `VITE_*`
value into the JavaScript when `npm run build` runs. Editing `.env` on the server and
reloading Apache changes nothing. To change the API URL you rebuild.

**2. `index.html` must never be cached; `/assets/*` should be cached forever.** Asset
filenames contain a content hash (`index-DC9yltNi.js`), so they are safe to cache for a
year — a new build produces a new name. But if a browser caches `index.html`, it keeps
asking for the *old* hashed files, which no longer exist, and the user gets a white screen
until they hard-refresh. The vhost below gets this right.

---

## 1. Build

The API is on a different origin from the UI, so **`VITE_MEDIA_BASE_URL` is required** —
without it every menu photo resolves against `mealhub.store` and 404s.

```bash
cd /var/www/mealhub/officelunchbox_ui

cat > .env <<'ENV'
VITE_API_BASE_URL=https://api.mealhub.store/api
VITE_MEDIA_BASE_URL=https://api.mealhub.store
VITE_APP_NAME=Mealhub
VITE_APP_DESCRIPTION=Chef-curated lunch boxes delivered daily to your tech park.
VITE_CURRENCY_SYMBOL=₹
VITE_LOCALE=en-IN
VITE_TIMEZONE=Asia/Kolkata
VITE_WHATSAPP_CHANNEL_URL=https://whatsapp.com/channel/0029Vb8RVR81iUxhMVsuxV1O
VITE_POLL_WINDOW_MS=60000
VITE_POLL_MENU_MS=45000
VITE_POLL_ADMIN_MS=30000
VITE_POLL_ORDERS_MS=45000
ENV

npm ci
npm run build
```

`VITE_TIMEZONE` **must match** the API's `TIMEZONE`. If they disagree, the client and
server disagree about which day "today" is — the menu and the ordering cutoff go wrong
around midnight.

If Node is not on the box:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

Check the build actually picked up your values before going further:

```bash
grep -o 'https://api.mealhub.store[^"]*' dist/assets/*.js | sort -u
grep -o '<title>[^<]*</title>' dist/index.html
```

You should see the API and media URLs, and `<title>Mealhub</title>`. If you see `/api`
instead, `.env` was not read — check you are in the right directory.

### Building elsewhere

If you would rather not put Node on the server, build on your machine and copy `dist/`:

```bash
rsync -avz --delete dist/ root@vmi1314728:/var/www/mealhub/officelunchbox_ui/dist/
```

`--delete` matters: it removes the previous build's hashed assets. Without it the
directory grows forever.

---

## 2. Permissions

Apache reads these; nothing writes to them.

```bash
sudo chown -R www-data:www-data /var/www/mealhub/officelunchbox_ui/dist
sudo find /var/www/mealhub/officelunchbox_ui/dist -type d -exec chmod 755 {} \;
sudo find /var/www/mealhub/officelunchbox_ui/dist -type f -exec chmod 644 {} \;
```

---

## 3. Apache virtual host

Port 80 first, so certbot can answer the challenge:

```bash
sudo tee /etc/apache2/sites-available/mealhub.store.conf > /dev/null <<'VHOST'
<VirtualHost *:80>
    ServerName mealhub.store
    ServerAlias www.mealhub.store

    DocumentRoot /var/www/mealhub/officelunchbox_ui/dist

    ErrorLog  ${APACHE_LOG_DIR}/mealhub.store-error.log
    CustomLog ${APACHE_LOG_DIR}/mealhub.store-access.log combined

    <Directory /var/www/mealhub/officelunchbox_ui/dist>
        Require all granted
        Options -Indexes -ExecCGI
        AllowOverride None
        FallbackResource /index.html
    </Directory>
</VirtualHost>
VHOST

sudo a2ensite mealhub.store
sudo apache2ctl configtest && sudo systemctl reload apache2
```

Point the `A` records for `mealhub.store` and `www.mealhub.store` at this server, then:

```bash
sudo certbot --apache -d mealhub.store -d www.mealhub.store
```

Now **replace** the generated `mealhub.store-le-ssl.conf` — certbot's version has no cache
policy, which is the failure described at the top:

```bash
sudo tee /etc/apache2/sites-available/mealhub.store-le-ssl.conf > /dev/null <<'VHOST'
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName mealhub.store
    ServerAlias www.mealhub.store

    DocumentRoot /var/www/mealhub/officelunchbox_ui/dist

    ErrorLog  ${APACHE_LOG_DIR}/mealhub.store-error.log
    CustomLog ${APACHE_LOG_DIR}/mealhub.store-access.log combined

    # ── One canonical host ────────────────────────────────────────────────────
    # Two origins would mean two localStorage buckets: sign in on www, and the
    # apex looks signed out.
    <If "%{HTTP_HOST} == 'www.mealhub.store'">
        Redirect permanent / https://mealhub.store/
    </If>

    <Directory /var/www/mealhub/officelunchbox_ui/dist>
        Require all granted
        Options -Indexes -ExecCGI
        AllowOverride None

        # React Router owns the URLs. Without this, refreshing on /admin/orders
        # makes Apache look for a file at that path and return 404.
        FallbackResource /index.html
    </Directory>

    # ── Hashed assets: cache hard ─────────────────────────────────────────────
    # A new build emits new filenames, so these can never go stale.
    <Directory /var/www/mealhub/officelunchbox_ui/dist/assets>
        # Do NOT fall back to index.html here. A missing asset must 404, not
        # return HTML that the browser then tries to parse as JavaScript.
        FallbackResource disabled
        <IfModule mod_headers.c>
            Header set Cache-Control "public, max-age=31536000, immutable"
        </IfModule>
    </Directory>

    # ── index.html: never cache ───────────────────────────────────────────────
    # It is the map to the hashed assets. A stale copy points at files that were
    # deleted by the last deploy, and the app renders blank.
    <FilesMatch "^index\.html$">
        <IfModule mod_headers.c>
            Header set Cache-Control "no-cache, must-revalidate"
        </IfModule>
    </FilesMatch>

    # ── Compression ───────────────────────────────────────────────────────────
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/css application/javascript \
                                      application/json image/svg+xml
    </IfModule>

    # ── Security headers ──────────────────────────────────────────────────────
    <IfModule mod_headers.c>
        Header always set X-Content-Type-Options "nosniff"
        Header always set X-Frame-Options "SAMEORIGIN"
        Header always set Referrer-Policy "strict-origin-when-cross-origin"
        Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
    </IfModule>

    SSLCertificateFile    /etc/letsencrypt/live/mealhub.store/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/mealhub.store/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
VHOST

sudo a2enmod headers deflate expires
sudo apache2ctl configtest && sudo systemctl reload apache2
```

---

## 4. Let the API accept this origin

The browser blocks cross-origin requests unless the API says otherwise. Add the frontend
origin to the **API's** `.env` — exact scheme, no trailing slash:

```bash
cd /var/www/mealhub/officelunchbox_api
nano .env
```

```env
ALLOWED_ORIGINS=https://mealhub.store,https://www.mealhub.store
```

```bash
sudo systemctl restart mealhub-api
```

Remember: no inline comments in that file — systemd does not strip them.

---

## 5. Verify

```bash
# Page loads
curl -s -o /dev/null -w '%{http_code}\n' https://mealhub.store/

# Deep link survives a refresh — must be 200, not 404
curl -s -o /dev/null -w '%{http_code}\n' https://mealhub.store/admin/orders

# index.html is not cached
curl -sI https://mealhub.store/ | grep -i cache-control
# expect: no-cache, must-revalidate

# Assets are cached hard
ASSET=$(ls /var/www/mealhub/officelunchbox_ui/dist/assets/*.js | xargs -n1 basename)
curl -sI "https://mealhub.store/assets/$ASSET" | grep -i cache-control
# expect: public, max-age=31536000, immutable

# A missing asset 404s rather than returning HTML
curl -s -o /dev/null -w '%{http_code}\n' https://mealhub.store/assets/does-not-exist.js
# expect: 404

# www redirects to the apex
curl -sI https://www.mealhub.store/ | head -2

# The QR asset is served
curl -s -o /dev/null -w '%{http_code}\n' https://mealhub.store/whatsapp-channel-qr.svg

# CORS: the API accepts this origin
curl -s -I -H "Origin: https://mealhub.store" \
     https://api.mealhub.store/api/settings/public | grep -i access-control-allow-origin
```

Then in a browser, with devtools open:

1. `https://mealhub.store` → sign in.
2. **Network tab**: requests go to `api.mealhub.store`, no CORS errors in the console.
3. Menu photos load — if they 404 against `mealhub.store`, `VITE_MEDIA_BASE_URL` was
   missing at build time. Rebuild.
4. Hard-refresh on `/admin/orders` — the page renders, not a 404.
5. `/bulk-orders` while signed out — it is public by design.

---

## Deploying an update

```bash
cd /var/www/mealhub/officelunchbox_ui
git pull
npm ci
npm run build
sudo chown -R www-data:www-data dist
```

No Apache reload needed — the files are read per request. Because `index.html` is
`no-cache`, returning visitors pick up the new build on their next navigation.

`npm ci` rather than `npm install`: it installs exactly what is in `package-lock.json`, so
a production build can never quietly pull a different dependency version than you tested.

**Rollback** — keep the previous build:

```bash
cd /var/www/mealhub/officelunchbox_ui
cp -r dist dist.bak.$(date +%F-%H%M)     # before building
# to roll back:
rm -rf dist && mv dist.bak.<timestamp> dist && sudo chown -R www-data:www-data dist
```

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| **404 on refresh at `/admin/...`** | `FallbackResource /index.html` missing from the `<Directory>` block |
| **Blank page after a deploy, works after hard refresh** | `index.html` was cached — check its `Cache-Control` is `no-cache` |
| **Console: "Unexpected token '<'"** | A missing asset returned `index.html`. `FallbackResource disabled` on `/assets` is missing |
| **CORS errors** | Frontend origin missing from the API's `ALLOWED_ORIGINS`, or it has a trailing slash, or the API was not restarted |
| **Menu photos 404** | `VITE_MEDIA_BASE_URL` unset at build time — rebuild, it cannot be fixed server-side |
| **Still hitting the old API URL** | Env vars are baked in at build time; you edited `.env` without rebuilding |
| **Signed in on www, signed out on apex** | The www redirect is missing, so two origins each hold their own localStorage |
| **Ordering window off by hours** | `VITE_TIMEZONE` disagrees with the API's `TIMEZONE` |
| **403 Forbidden** | `dist/` not readable by `www-data` — re-run the chown/chmod in step 2 |
