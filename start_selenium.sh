#!/bin/sh
export DISPLAY=:10


xvfb-run webdriver-manager start --standalone  &
