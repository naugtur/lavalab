#!/bin/bash
mkdir -p samples
npm pack ./cli
docker build -t lab-no-net-alpine-image .
docker run --rm -it \
  --network none \
  --name lab-no-net-alpine \
  --entrypoint ash \
  -v $(pwd)/samples:/lab/samples \
  lab-no-net-alpine-image \
