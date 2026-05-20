#!/bin/bash

KIBANA_URL="http://localhost:5601"
NDJSON_FILE="/tmp/dashboard.ndjson"

/usr/local/bin/kibana-docker &

echo "Waiting for kibana..."
until curl -s -o /dev/null -w "%{http_code}" "$KIBANA_URL/api/status" | grep -q "200"; do
	sleep 5
done
echo "Kibana is ready!"

curl -X POST "$KIBANA_URL/api/saved_objects/_import?overwrite=true" \
	-H "kbn-xsrf: true" \
	-H "Content-Type: multipart/form-data" \
 	--form file=@"$NDJSON_FILE"

echo ""
echo "Dashboard imported!"

wait