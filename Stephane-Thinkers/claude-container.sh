#!/bin/bash

# Helper script to run Claude Code CLI inside the devcontainer

cd "$(dirname "$0")"

if [ "$1" = "shell" ]; then
    # Open an interactive shell in the container
    docker-compose -f .devcontainer/docker-compose.yml exec app bash
elif [ "$1" = "claude" ]; then
    # Run claude CLI with remaining arguments
    shift
    docker-compose -f .devcontainer/docker-compose.yml exec app claude "$@"
else
    echo "Usage:"
    echo "  ./claude-container.sh shell          - Open interactive shell in container"
    echo "  ./claude-container.sh claude [args]  - Run Claude Code CLI in container"
    echo ""
    echo "Examples:"
    echo "  ./claude-container.sh shell"
    echo "  ./claude-container.sh claude --help"
    echo "  ./claude-container.sh claude chat"
fi
