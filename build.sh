#!/bin/bash
exclude_list=".gitignore out build.sh LICENSE README.md .git .idea .DS_Store .npm"
rm -rf ./out
mkdir -p ./out
for file in *
do
    if [[ ! " $exclude_list " =~ " $file " ]]; then
        rsync -a \
            --exclude "*.map" \
            --exclude "*.js.gz" \
            --exclude "*.css.gz" \
            --exclude "*.debug.js" \
            --exclude "*.debug.css" \
            "$file" ./out
    fi
done
echo "build success"
