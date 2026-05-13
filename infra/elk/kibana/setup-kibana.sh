#!/bin/bash

KIBANA_URL="http://kibana:5601"
NDJSON_FILE="/tmp/dashboard.ndjson"

echo "Waiting for kibana..."
until curl -s -o /dev/null "$KIBANA_URL/api/status"; do
	sleep 5
done
echo "Kibana is ready!"

curl -X POST "$KIBANA_URL/api/saved_obdjects/_import?overwrite=true" \
	-H "kbn-xsrf: true" \
	--form file=@"NDJSON_FILE"

echo ""
echo "Dashboard imported!"