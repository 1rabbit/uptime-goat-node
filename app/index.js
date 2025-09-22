const https = require('https');
const http = require('http');
const fs = require('fs').promises;

// Load environment variables
require('dotenv').config();

const GOAT_ID = process.env.GOAT_ID;
const GOAT_KEY = process.env.GOAT_KEY;
const ENDPOINTS_URL = 'https://raw.githubusercontent.com/1rabbit/goat_servers/refs/heads/main/uptime_endpoints';
const TIMESTAMP_FILE = '/data/last_report_timestamp';

// Logging with timestamp
const log = (level, message) => {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 23);
  if (level === 'ERROR') {
    console.log(`${timestamp} ERROR: ${message}`);
  } else {
    console.log(`${timestamp} ${message}`);
  }
};

// Validate hex values
const validateHex = (value, name) => {
  if (!value || value.length !== 32 || !/^[0-9a-f]{32}$/i.test(value)) {
    log('ERROR', `${name} must be a valid 32-character hexadecimal value`);
    process.exit(1);
  }
};

// HTTP/HTTPS request helper
const makeRequest = (urlString, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const protocol = url.protocol === 'https:' ? https : http;

      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 30000
      };

      const req = protocol.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ data, statusCode: res.statusCode });
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Fetch endpoints from URL
async function fetchEndpoints() {
  try {
    const startTime = Date.now();
    const response = await makeRequest(ENDPOINTS_URL);
    const fetchTime = Date.now() - startTime;

    // Parse the JSON response
    let endpoints;
    try {
      endpoints = JSON.parse(response.data);
    } catch (parseError) {
      log('ERROR', `Failed to parse endpoints JSON: ${parseError.message}`);
      return null;
    }

    // Validate that we got an object with URLs
    if (!endpoints || typeof endpoints !== 'object') {
      log('ERROR', 'Invalid endpoints format received');
      return null;
    }

    console.log(`${new Date().toISOString().replace('T', ' ').substring(0, 23)} Fetched endpoints in ${fetchTime}ms:`);
    console.log(JSON.stringify(endpoints, null, 2));
    return endpoints;
  } catch (error) {
    log('ERROR', `Failed to fetch endpoints: ${error.message}`);
    return null;
  }
}

// Save baseline timestamp
async function saveTimestamp(timestamp) {
  try {
    await fs.writeFile(TIMESTAMP_FILE, timestamp.toString());
  } catch (error) {
    log('ERROR', `Failed to save timestamp: ${error.message}`);
  }
}

// Load last report timestamp
async function loadTimestamp() {
  try {
    const data = await fs.readFile(TIMESTAMP_FILE, 'utf8');
    return parseInt(data);
  } catch (error) {
    return null;
  }
}

// Send goat report for a single server
async function sendGoatReport(serverName, url, maxServerLen) {
  const startTime = Date.now();
  const payload = JSON.stringify({ goat_id: GOAT_ID, goat_key: GOAT_KEY });

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 55000
      };

      let responseTime;

      const req = protocol.request(requestOptions, (res) => {

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsedData = JSON.parse(data);
              const minerName = parsedData.name || 'Unknown';
              const deviationMs = parsedData.ms_deviation || 0;
              const padding = ' '.repeat(maxServerLen - serverName.length + 5);

              log('INFO', `🐐 ${minerName} → ${serverName}${padding}deviation ${String(deviationMs).padStart(4)}ms   ping ${responseTime}ms`);
              resolve({ success: true, deviation: deviationMs });
            } else {
              log('ERROR', `Request failed for ${serverName}: Status ${res.statusCode}`);
              resolve({ success: false, deviation: null });
            }
          } catch (error) {
            log('ERROR', `Request failed for ${serverName}: ${error.message}`);
            resolve({ success: false, deviation: null });
          }
        });
      });

      req.on('socket', (socket) => {
        socket.on('connect', () => {
          // Measure time when TCP connection is established
          responseTime = Date.now() - startTime;
        });
      });

      req.on('error', (error) => {
        log('ERROR', `Request failed for ${serverName}: ${error.message}`);
        resolve({ success: false });
      });

      req.on('timeout', () => {
        req.destroy();
        log('ERROR', `Request timeout for ${serverName}`);
        resolve({ success: false, deviation: null });
      });

      req.write(payload);
      req.end();
    } catch (error) {
      log('ERROR', `Request failed for ${serverName}: ${error.message}`);
      resolve({ success: false, deviation: null });
    }
  });
}

// Main goat reporting loop
async function goatReportLoop(endpoints) {
  const serverNames = Object.keys(endpoints);
  const maxServerLen = Math.max(...serverNames.map(name => name.length));

  log('INFO', '📯 Sending goat report');

  // Send all requests in parallel
  const promises = serverNames.map(serverName =>
    sendGoatReport(serverName, endpoints[serverName], maxServerLen)
  );

  const results = await Promise.all(promises);

  // Check if all successful responses have deviations > 1000ms AND at least one < 2000ms
  const validDeviations = results.filter(r => r.success && r.deviation !== null).map(r => r.deviation);
  const allDeviationsHigh = validDeviations.length > 0 && validDeviations.every(d => Math.abs(d) > 1000);
  const someDeviationUnder2000 = validDeviations.some(d => Math.abs(d) < 2000);
  const needsExtraDelay = allDeviationsHigh && someDeviationUnder2000;

  if (needsExtraDelay) {
    log('INFO', '⚠️  All deviations > 1000ms with at least one < 2000ms, adding 1000ms extra delay to next cycle');
  }

  return { needsExtraDelay };
}

// Main application
async function main() {
  // Validate environment variables
  validateHex(GOAT_ID, 'GOAT_ID');
  validateHex(GOAT_KEY, 'GOAT_KEY');

  log('INFO', '🐐 Starting uptime-goat service...');

  // Always fetch endpoints first
  let endpoints = await fetchEndpoints();
  if (!endpoints) {
    log('ERROR', 'Failed to fetch endpoints on startup. Exiting...');
    process.exit(1);
  }

  // Check for saved next target time to potentially continue streak
  const savedNextTime = await loadTimestamp();
  const now = Date.now();
  let nextTargetTime = null;

  if (savedNextTime) {
    log('INFO', `📖 Loaded saved target: ${new Date(savedNextTime).toISOString()}`);
  }

  if (savedNextTime && savedNextTime > now) {
    const timeUntilNext = savedNextTime - now;

    // If there's at least 1 second until the next report, save the streak
    if (timeUntilNext >= 1000) {
      nextTargetTime = savedNextTime;
      log('INFO', `🔥 Consecutives saved! Next report in ${(timeUntilNext/1000).toFixed(1)}s...`);
      await new Promise(resolve => setTimeout(resolve, timeUntilNext));
    } else {
      // Too close, might miss it
      log('INFO', `Next report in ${(timeUntilNext/1000).toFixed(1)}s - too close to save reliably`);
      // Initial random sleep between 10-70 seconds (inclusive)
      const initialSleep = Math.floor(Math.random() * 60001) + 10000; // 10000-70000ms inclusive
      log('INFO', `😴 Sleeping for ${(initialSleep/1000).toFixed(1)} seconds before starting...`);
      await new Promise(resolve => setTimeout(resolve, initialSleep));
      nextTargetTime = Date.now() + 60000;
    }
  } else {
    // No saved timestamp or it's in the past, do normal startup
    // Initial random sleep between 10-70 seconds (inclusive)
    const initialSleep = Math.floor(Math.random() * 60001) + 10000; // 10000-70000ms inclusive
    log('INFO', `😴 Sleeping for ${(initialSleep/1000).toFixed(1)} seconds before starting...`);
    await new Promise(resolve => setTimeout(resolve, initialSleep));
    nextTargetTime = Date.now() + 60000;
  }

  // Track cycle count for endpoint updates
  let cycleCount = 0;

  // Recursive function to run report cycles
  async function runReportCycle() {
    let extraDelay = 0;
    try {
      // Only send reports if we have valid endpoints
      if (endpoints && Object.keys(endpoints).length > 0) {
        const result = await goatReportLoop(endpoints);
        if (result.needsExtraDelay) {
          extraDelay = 1000; // Add 1 second extra delay
        }
      } else {
        log('ERROR', 'No valid endpoints available, skipping this cycle');
      }

      // Update endpoints every 10 cycles AFTER sending reports
      cycleCount++;
      if (cycleCount % 10 === 0) {
        const newEndpoints = await fetchEndpoints();
        if (newEndpoints) {
          endpoints = newEndpoints;
        } else {
          log('INFO', 'Endpoint update failed, continuing with existing endpoints');
        }
      }
    } catch (error) {
      log('ERROR', `Error in report cycle: ${error.message}. Continuing...`);
    }

    // Update next target time for next cycle and save it (with extra delay if needed)
    nextTargetTime += 60000 + extraDelay;
    await saveTimestamp(nextTargetTime);

    // Calculate delay to hit the exact target time
    const delay = Math.max(0, nextTargetTime - Date.now());

    // Schedule the next cycle for the precise target time
    setTimeout(runReportCycle, delay);
  }

  // Start the first report cycle
  runReportCycle();

  // Keep the main function running forever
  await new Promise(() => {}); // Never resolves
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  log('INFO', 'Script interrupted by user. Exiting...');
  process.exit(0);
});

// Start the application with crash protection
main().catch(error => {
  log('ERROR', `Fatal error: ${error.message}`);
  process.exit(1);
});