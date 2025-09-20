# 🐐 Uptime Goat Node

A lightweight Node.js service that periodically sends reports to the [**Cryptards**](https://cryptards.lol/) Uptime Goat servers and automatically fetches endpoint updates.

![Uptime Goat](assets/goattime.jpg)

## 🚀 Features

- **Lightning Fast**: Built with Node.js for minimal resource usage and fast performance
- **Single Service**: Combined goat reporting and endpoint management in one clean service
- **Minimal Dependencies**: Only requires dotenv for environment variables
- **Docker Ready**: Alpine-based Docker image for quick deployment
- **Auto-updating Endpoints**: Fetches latest endpoints every 10 minutes

## 🐙 Quick Start with Docker Compose

**Prerequisites**:

- Docker Compose
- Docker
- Git

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Ducktatorrr/uptime-goat-node.git
   cd uptime-goat-node
   ```

2. **Create a `.env` file**:

   ```bash
   cp .env.example .env
   ```

3. **Open the `.env` file and set the `GOAT_ID` and `GOAT_KEY` variables**:

   ```bash
   GOAT_ID=<token_here>
   GOAT_KEY=<key_here>
   ENDPOINTS_URL=<PREFILLED>
   ```

   Replace `<token_here>` with your actual 32-character hexadecimal GOAT_ID and GOAT_KEY.

   You should not change the `ENDPOINTS_URL` variable unless you know what you are doing.

4. **Run the Docker Compose command**:

   ```bash
   docker-compose up -d
   ```

5. **Check the logs**:
   ```bash
   docker-compose logs -f
   ```

### Stopping & Updating the deployment

To stop the deployment:

```bash
docker-compose down
```

When a new version is released, pull the repository and rebuild:

```bash
git pull
docker-compose up --build -d
```

To restart the service:

```bash
docker-compose restart
```

### Upgrading without losing consecutives

The service can maintain its consecutive reports even during upgrades. Use this command to upgrade while preserving your consecutives:

```bash
./autowait.sh && docker-compose down && docker-compose build && docker-compose up -d && docker-compose logs -f
```

This will:
1. Wait for the optimal time to preserve timing
2. Stop the current container
3. Rebuild with new code
4. Start the new container
5. Show logs to confirm consecutives were saved

The service will automatically restore timing if restarted within the window.

## 🛠 Configuration

- **GOAT_ID and GOAT_KEY**: A 32-character hexadecimal token for authenticating with the goat servers. Set these in your `.env` file.

- **ENDPOINTS_URL**: URL to fetch the latest endpoint list (default: `https://raw.githubusercontent.com/1rabbit/goat_servers/refs/heads/main/uptime_endpoints`)

- **endpoints.json**: Local cache of endpoints, automatically updated every 10 minutes. The service will fetch and update these endpoints automatically.

## 📊 Log Format

The service logs reports in the following format:
```
2025-09-20 11:15:56 INFO: GOAT bogiluc → supgoat     deviation   23ms   response time 65ms
```

Showing:
- Miner name
- Server endpoint
- Deviation from expected timing
- Response time for the request

## 🐛 Error Handling

If the request fails, the script logs the error message and retries on the next cycle.

The service includes:
- Automatic restart on crashes
- Local endpoint caching to handle network issues
- Timeout handling for slow requests
- Graceful shutdown on SIGINT

## 🎉 Contributing

We welcome contributions! Feel free to submit issues, pull requests, or feature requests.

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.