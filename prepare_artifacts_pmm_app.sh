#!/bin/bash

### Change Access for Videos Generated.
chmod 777 -R video/

### Create Video output directory in tests folder
mkdir -p ./pmm-app/tests/output/video

### Go through failed test files in output_folder, move videos for failing tests.

for file in ./pmm-app/tests/output/parallel_chunk*/selenoid/*.json
do
  if [ -f "$file" ]; then
    mv video/$(cat ${file} | jq -r '.sessionid').mp4 pmm-app/tests/output/video/$(cat ${file} | jq -r '.testName' | sed -e 's/ /_/g').mp4
  fi
done

