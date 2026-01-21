#!/usr/bin/env bash
set -e

# Let Redis start
python taskiq_pre_start.py

# Start taskiq worker with proper Python path
export PYTHONPATH=/app:$PYTHONPATH

# Control logging based on environment variable
if [ "${TASKIQ_VERBOSE_LOGGING:-false}" = "true" ]; then
    taskiq worker app.tasks.worker:broker
else
    taskiq worker app.tasks.worker:broker --log-level WARNING
fi
