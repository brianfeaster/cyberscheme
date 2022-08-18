#!/bin/bash

printf "\nBuilding CyberScheme...\n"

while IFS=''; read line; do
  unset IFS
  read cmd filename _ <<<"$line"
  if [ "$cmd" == "#include" ]; then
    cat $filename
  else
    echo "$line"
  fi
done < cyberscheme.main > index.html

ls -l index.html

printf "Done.\n"
