#!/bin/sh

# Recreate config file
rm -f /usr/share/nginx/html/env-config.js

# Generate JSON
{
  echo "window._env_ = {"
  
  # Store env vars in a temp file to avoid subshell issues with while loop
  printenv | grep VITE_ > /tmp/vite_env_vars || true
  
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
