#!/bin/sh

# Recreate config file
rm -rf /usr/share/nginx/html/env-config.js
touch /usr/share/nginx/html/env-config.js

# Add assignment
echo "window._env_ = {" >> /usr/share/nginx/html/env-config.js

first=true

# Read environment variables matching VITE_ prefix
# Each line represents key=value pairs
printenv | grep VITE_ | while read -r line; do
  # Split env variables by character `=`
  if printf '%s\n' "$line" | grep -q -e '='; then
    varname=$(printf '%s\n' "$line" | sed -e 's/=.*//')
    varvalue=$(printf '%s\n' "$line" | sed -e 's/^[^=]*=//')
  fi

  # Read value of current variable if exists as Environment variable
  value=$(printf '%s\n' "${varvalue}" | sed -e 's/\\/\\\\/g' -e 's/\"/\\"/g' -e "s/'/\\'/g" -e 's/\n/\\n/g')
  
  # Append configuration property to JS file
  if [ "$first" = true ]; then
    first=false
  else
    echo "," >> /usr/share/nginx/html/env-config.js
  fi
  printf "  %s: \"%s\"" "$varname" "$value" >> /usr/share/nginx/html/env-config.js
done

echo "};" >> /usr/share/nginx/html/env-config.js
