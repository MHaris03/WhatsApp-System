# Deploy the backend on Oracle Cloud (Always Free)

The backend runs as a Docker container behind **Caddy** (automatic HTTPS) on a
free Oracle **ARM Ampere** VM. The frontend stays on Vercel and points at this
backend via `VITE_BACKEND_URL`.

> Files used: [`backend/Dockerfile`](backend/Dockerfile),
> [`docker-compose.yml`](docker-compose.yml), [`Caddyfile`](Caddyfile).

---

## 0. What you need
- An Oracle Cloud account (free; requires a card for verification — Always-Free
  resources are not charged).
- Your **MongoDB Atlas** connection string (the non-SRV one already in `backend/.env`).
- A **domain name** for HTTPS (e.g. `api.yoursite.com`). No domain? See
  **Alternative B (Cloudflare Tunnel)** at the bottom.

---

## 1. Create the VM
1. Oracle Cloud Console → **Compute → Instances → Create instance**.
2. **Image:** Canonical **Ubuntu 22.04**.
3. **Shape:** **Ampere (ARM) — VM.Standard.A1.Flex**, e.g. 2 OCPU / 12 GB RAM
   (well within Always Free). *If you see "Out of host capacity", try another
   Availability Domain or region, or retry later.*
4. **Add your SSH key** (upload your public key or let it generate one — save it).
5. Create, then note the instance's **public IP**.

## 2. Open the firewall (Oracle has TWO layers — do both)
**a) Cloud network (VCN):** Networking → your VCN → the subnet → **Security List**
→ **Add Ingress Rules**:
- Source `0.0.0.0/0`, IP Protocol TCP, Destination port **80**
- Source `0.0.0.0/0`, IP Protocol TCP, Destination port **443**

**b) OS firewall (on the VM, via SSH):**
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. SSH in and install Docker
```bash
ssh ubuntu@YOUR_PUBLIC_IP

sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# log out and back in so the docker group applies
exit
ssh ubuntu@YOUR_PUBLIC_IP
```

## 4. Get the code and configure
```bash
git clone https://github.com/YOUR_USER/YOUR_REPO.git
cd YOUR_REPO

# Create the backend env file with your Atlas connection string:
nano backend/.env
```
Put this in `backend/.env` (one line):
```
MONGODB_URI=mongodb://USER:PASS@host1:27017,host2:27017,host3:27017/?ssl=true&replicaSet=...&authSource=admin&retryWrites=true&w=majority
```
(Optional: `MONGODB_DB=WhatsApp-System`, `DEFAULT_COUNTRY_CODE=92`.)

## 5. Point your domain + edit the Caddyfile
- Create a DNS **A record**: `api.yoursite.com` → **YOUR_PUBLIC_IP**.
- Edit [`Caddyfile`](Caddyfile) and replace `api.example.com` with `api.yoursite.com`.

## 6. Launch
```bash
docker compose up -d --build
docker compose logs -f backend   # watch startup
```
You should see `Connected to MongoDB Atlas` and `Backend running on http://localhost:4000`.
Caddy will fetch the HTTPS certificate automatically (give it ~30s).

## 7. Allow Atlas + connect the frontend
- **MongoDB Atlas → Network Access** → add the VM's public IP (or `0.0.0.0/0` to test).
- **Vercel** → frontend env var **`VITE_BACKEND_URL`** = `https://api.yoursite.com` → redeploy.
- Open your Vercel site → **Connect WhatsApp** popup shows the QR → scan it. Done.
  The session is saved in the `wwebjs_auth` volume, so you won't rescan after restarts.

## Updating later
```bash
cd YOUR_REPO && git pull && docker compose up -d --build
```

---

## Alternative B — no domain (Cloudflare Tunnel)
If you don't have a domain, skip Caddy and expose the backend with a free
Cloudflare Tunnel:
```bash
# Run only the backend, published on localhost:4000
docker compose up -d --build backend   # (temporarily add `ports: ["4000:4000"]` to the backend service)

# Install cloudflared, then:
cloudflared tunnel --url http://localhost:4000
```
It prints a public `https://<random>.trycloudflare.com` URL — use that as
`VITE_BACKEND_URL` on Vercel. (For a stable URL, set up a named tunnel with a
Cloudflare-managed domain.)

---

## Troubleshooting
- **Site not reachable:** you missed one of the two firewall layers (step 2).
- **TLS won't issue:** DNS A record not propagated yet, or port 80 blocked (Caddy
  needs 80 for the Let's Encrypt challenge).
- **Chromium errors:** ensure you're on the ARM image with this repo's Dockerfile
  (it installs system Chromium). Check `docker compose logs backend`.
- **High memory:** give the A1 instance more RAM (it's free up to 24 GB).
