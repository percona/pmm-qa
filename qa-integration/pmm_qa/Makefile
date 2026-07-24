default: help

help:                       ## Display this help message.
	@echo "Please use \`make <target>\` where <target> is one of:"
	@grep '^[a-zA-Z]' $(MAKEFILE_LIST) | \
	awk -F ':.*?## ' 'NF==2 {printf "  %-26s%s\n", $$1, $$2}'

init:                 ## Create venv and install dependencies
	python3 -m venv pmm_framework
	pmm_framework/bin/pip install --upgrade pip
	pmm_framework/bin/pip install --no-cache-dir -r requirements.txt

init-ubuntu:                 ## Create venv and install dependencies for ubuntu
	sudo chown $(whoami) -R .
	apt install -y python3.10-venv
	python3 -m venv virtenv
	. virtenv/bin/activate
	python --version
	which python
	python -m pip install -r requirements.txt

