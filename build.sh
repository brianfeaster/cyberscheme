#!/bin/bash

printf "\nBuilding CyberScheme...\n"

while IFS=''; read line; do
  unset IFS
  read cmd filename _ <<<"$line"
  if [ "$cmd" == "#include" ]; then
    cat $filename
  elif [[ "$line" =~ (.*)\<#include([^>]*)\>(.*) ]]; then
    printf "${BASH_REMATCH[1]}"
    cat ${BASH_REMATCH[2]}
    [ "${BASH_REMATCH[3]}" ] && echo "${BASH_REMATCH[3]}"
  else
    echo "$line"
  fi
done < cyberscheme.html > index.html

ls -l index.html

printf "Done.\n"
