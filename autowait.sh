#!/bin/bash

# Path to the timestamp file
TIMESTAMP_FILE="data/last_report_timestamp"

# Function to get current timestamp in milliseconds
get_current_timestamp() {
    echo $(($(date +%s%N)/1000000))
}

# Main monitoring loop
while true; do
    # Check if timestamp file exists
    if [ ! -f "$TIMESTAMP_FILE" ]; then
        echo "Error: $TIMESTAMP_FILE not found"
        exit 1
    fi
    
    # Read the stored timestamp
    stored_timestamp=$(cat "$TIMESTAMP_FILE")
    
    # Validate that we got a number
    if ! [[ "$stored_timestamp" =~ ^[0-9]+$ ]]; then
        echo "Error: Invalid timestamp in file: $stored_timestamp"
        exit 1
    fi
    
    # Get current timestamp
    current_timestamp=$(get_current_timestamp)
    
    # Calculate how long until the target timestamp (negative if we're before it)
    time_until=$((stored_timestamp - current_timestamp))
    
    # Convert to seconds for display
    time_until_seconds=$((time_until / 1000))
    time_until_ms=$((time_until % 1000))
    
    # Check if we're in the target window (55000ms to 59000ms BEFORE the timestamp)
    if [ $time_until -ge 55000 ] && [ $time_until -le 59000 ]; then
        echo "✓ In window! Time until timestamp: ${time_until_seconds}.${time_until_ms}s"
        exit 0
    elif [ $time_until -gt 59000 ]; then
        echo "⏳ Too early. Time until timestamp: ${time_until_seconds}.${time_until_ms}s"
    elif [ $time_until -lt 55000 ] && [ $time_until -gt 0 ]; then
        echo "⚡ Too close. Time until timestamp: ${time_until_seconds}.${time_until_ms}s"
    else
        # time_until is negative, meaning we've passed the timestamp
        time_past=$((-time_until))
        time_past_seconds=$((time_past / 1000))
        time_past_ms=$((time_past % 1000))
        echo "⏰ Timestamp passed. Time since timestamp: ${time_past_seconds}.${time_past_ms}s"
    fi
    
    # Wait 1 second before checking again
    sleep 1
done