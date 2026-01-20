#!/usr/bin/env bash
set -e

# Let Redis start
python taskiq_pre_start.py

# Start taskiq scheduler
cd app
taskiq scheduler tasks.worker:scheduler
