#!/bin/bash
exclude_list=".gitignore out build.sh LICENSE README.md .git .idea"
rm -rf ./out
mkdir -p ./out
for file in *
do
    if [[ ! " $exclude_list " =~ " $file " ]]; then
        cp -r "$file" ./out
    fi
done
echo "build success"