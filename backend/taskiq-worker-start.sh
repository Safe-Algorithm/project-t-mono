#!/usr/bin/env bash
set -e

# Let Redis start
python taskiq_pre_start.py

# Start taskiq worker
cd app
taskiq worker tasks.worker:broker
