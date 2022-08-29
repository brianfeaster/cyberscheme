#!/bin/bash

OUTFILE=index.html


case "$1" in
 (dev) OUTFILE=dev.html ;;
esac

printf "\nBuilding CyberScheme to $OUTFILE\n"

while IFS=''; read line; do
  unset IFS
  if [[ "$line" =~ (.*)\<#include([^>]*)\>(.*) ]]; then
    printf "${BASH_REMATCH[1]}"
    printf " Merging file:${BASH_REMATCH[2]}\n" 1>&2
    cat ${BASH_REMATCH[2]}
    [ "${BASH_REMATCH[3]}" ] && echo "${BASH_REMATCH[3]}"
  else
    echo "$line"
  fi
done < cyberscheme.html 2>&1 > $OUTFILE

printf "\nResult:\n"
ls -laF index.html

printf "\nDone."
