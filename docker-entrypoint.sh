#!/bin/sh
# docker-entrypoint.sh

# The directory where the database will be stored.
# This directory is expected to be mounted as a volume.
DB_DIR="/usr/src/app/db"
DB_FILE="$DB_DIR/database.sqlite"

# Create the database directory if it doesn't exist
mkdir -p $DB_DIR

# Check if the database file exists.
# If it doesn't, this is the first time the container is running.
if [ ! -f "$DB_FILE" ]; then
    echo "Database not found. Initializing..."
    
    # Initialize the database schema
    bun run init-db.js
    
    # Seed the database with initial data
    bun run seed.js
    
    echo "Database initialized and seeded."
else
    echo "Database found. Skipping initialization."
fi

# Execute the main command (e.g., start the server)
exec "$@"
