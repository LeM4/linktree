# Use bun's official image
FROM oven/bun:1.0

# Set the working directory
WORKDIR /usr/src/app

# Copy all project files into the container.
# This assumes you have already run 'bun install' and 'bun run build:css' locally.
COPY . .

# Install ONLY production dependencies.
# We assume the CSS is already built and dev dependencies are not needed.
RUN bun install

# Ensure the entrypoint script is executable
RUN chmod +x docker-entrypoint.sh

# Expose the application ports
EXPOSE 3000
EXPOSE 3001

# Set the entrypoint and default command
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "start:prod"]
