#!/usr/bin/env bash
set -e

# Let Redis start
python taskiq_pre_start.py

# Start taskiq scheduler with proper Python path
export PYTHONPATH=/app:$PYTHONPATH

# Control logging based on environment variable
if [ "${TASKIQ_VERBOSE_LOGGING:-false}" = "true" ]; then
    taskiq scheduler app.tasks.worker:scheduler
else
    taskiq scheduler app.tasks.worker:scheduler --log-level WARNING
fi
