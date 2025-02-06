#!/bin/bash

# Define the directory where the libraries will be cloned
LIBS_DIR="lib"

# Create the directory if it doesn't exist
mkdir -p $LIBS_DIR

# Clone bats-support
if [ ! -d "$LIBS_DIR/bats-support" ]; then
    git clone https://github.com/bats-core/bats-support.git $LIBS_DIR/bats-support
else
    echo "bats-support is already present."
fi

# Clone bats-assert
if [ ! -d "$LIBS_DIR/bats-assert" ]; then
    git clone https://github.com/bats-core/bats-assert.git $LIBS_DIR/bats-assert
else
    echo "bats-assert is already present."
fi

echo "BATS libraries setup completed"
