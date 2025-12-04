#!/bin/sh

# Recreate config file
rm -f /usr/share/nginx/html/env-config.js

# Generate JSON
{
  echo "window._env_ = {"
  
  # Store env vars in a temp file to avoid subshell issues with while loop
  # Only include env vars whose names start with VITE_
  printenv | grep -E '^VITE_' > /tmp/vite_env_vars || true
  
  # If no VITE_ environment variables exist, /tmp/vite_env_vars will be empty,
  # and the resulting env-config.js will contain an empty object (window._env_ = {};).
  # This is intentional and ensures valid JS output in all cases.
  
  first=true
  while read -r line; do
    # Split env variables by character `=`
    if printf '%s\n' "$line" | grep -q -e '='; then
      varname=$(printf '%s\n' "$line" | sed -e 's/=.*//')
      varvalue=$(printf '%s\n' "$line" | sed -e 's/^[^=]*=//')
      
      # Escape special characters
      value=$(printf '%s\n' "${varvalue}" | sed -e 's/\\/\\\\/g' -e 's/\"/\\"/g' -e "s/'/\\'/g" -e 's/\n/\\n/g')
      
      # Append comma if not first
      if [ "$first" = true ]; then
        first=false
      else
        echo ","
      fi
      printf "  %s: \"%s\"" "$varname" "$value"
    fi
  done < /tmp/vite_env_vars
  
  # Clean up
  rm -f /tmp/vite_env_vars
  
  echo ""
  echo "};"
} > /usr/share/nginx/html/env-config.js
