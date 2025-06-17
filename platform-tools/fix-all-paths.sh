#!/bin/bash

# Fix all path issues in tools
FILES=$(grep -r "build/api/" . --include="*.js" | cut -d: -f1 | sort -u)

for file in $FILES; do
    echo "Fixing $file..."
    sed -i 's/build\/api\/models/build\/models/g' "$file"
    sed -i 's/build\/api\/util/build\/util/g' "$file"
    sed -i 's/build\/api\/jobs/build\/jobs/g' "$file"
    sed -i 's/build\/api\/routes/build\/routes/g' "$file"
    sed -i 's/build\/api\/scanner/build\/scanner/g' "$file"
done

echo "✅ All paths fixed!"