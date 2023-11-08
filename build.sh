#!/bin/bash
exclude_list=".gitignore .out .build.sh .LICENSE README.md .git .idea"
mkdir -p ./out
for file in *
do
    if [[ ! " $exclude_list " =~ " $file " ]]; then
        cp "$file" ./out
    fi
done
echo "build success"