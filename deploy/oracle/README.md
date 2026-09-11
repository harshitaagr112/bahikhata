# Oracle Cloud deployment

This runs the Go API on an Oracle Cloud Always Free VM. PostgreSQL remains on
Neon, so the VM only needs Docker and public HTTP/HTTPS access.

## 1. Create the VM

In Oracle Cloud, create an Always Free compute instance using Ubuntu 24.04.
Use an Ampere A1 shape if available, or an AMD Micro shape. Assign a public
IPv4 address and add ingress rules for TCP ports `80` and `443` in the VCN
security list. The Ubuntu firewall is configured below too.

## 2. Install Docker on the VM

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in once so the Docker group change takes effect.

## 3. Copy the project and configure secrets

```bash
git clone <your-repository-url> bahikhata
cd bahikhata/deploy/oracle
cp .env.example .env
nano .env
```

Set `API_DOMAIN` to the hostname that points to the VM, and provide the real
Neon `DATABASE_URL` and bcrypt password hash. Never commit `.env`.

## 4. Open the VM firewall and start the API

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
docker compose up -d --build
curl https://$API_DOMAIN/health
```

Caddy obtains and renews the TLS certificate automatically once DNS points
the hostname to the VM and ports `80` and `443` are reachable.

## 5. Connect Vercel

In the Vercel project, set the environment variable below for Production and
redeploy:

```text
API_URL=https://api.example.com
```

The Next.js rewrite sends `/api/*` requests from Vercel to this API. Verify
`https://<vercel-domain>/login` and sign in with the configured credentials.

## Updating the API

```bash
cd bahikhata
git pull
cd deploy/oracle
docker compose up -d --build
```
