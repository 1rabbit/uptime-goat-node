# 🐐 Uptime Goat Node

A lightweight Node.js service that periodically sends reports to the [**Uptime Goat**](https://uptime-goat.com/) servers and automatically fetches endpoint updates.

![Uptime Goat](data/goat.jpg)

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
   git clone https://github.com/1rabbit/uptime-goat-node.git
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
   ```

   Replace `<token_here>` with your actual 32-character hexadecimal GOAT_ID and GOAT_KEY.

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

### Upgrading without losing consecutives

When a new version is released, pull the repository and rebuild:
The service can maintain its consecutive reports even during upgrades. Use this command to upgrade while preserving your consecutives:

```bash
./autowait.sh && cd .. && git clone https://github.com/1rabbit/uptime-goat-node.git && cd uptime-goat-node && docker-compose down && docker-compose build && docker-compose up -d && docker-compose logs -f
```

This will:
1. Wait for the optimal time to preserve timing
2. Stop the current container
3. Rebuild with new code
4. Start the new container
5. Show logs to confirm consecutives were saved

The service will automatically restore timing if restarted within the window.

## 🐛 Error Handling

If the request fails, the script logs the error message and retries on the next cycle.

The service includes:
- Automatic restart on crashes
- Local endpoint caching to handle network issues
- Timeout handling for slow requests
- Graceful shutdown on SIGINT

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.